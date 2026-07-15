/**
 * /api/crm/import — CSV/XLSX import (§5-4). Accepts already-parsed rows from the
 * client wizard. Dry-run reports new/merge/held/skip; a real run inserts contacts,
 * links orgs by non-freemail domain, fills empty fields on email-matched dupes,
 * and records a crm_import_batches row. Admin-only.
 */
import { NextResponse } from "next/server";
import { getAdminUser, logContentEvent } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapRow, isFreemailDomain, type ContactDraft } from "@/lib/crm/importPresets";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { presetId?: string; rows?: Record<string, unknown>[]; dryRun?: boolean; filename?: string }
    | null;
  if (!body?.presetId || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "presetId and rows required" }, { status: 400 });
  }
  const { presetId, rows, dryRun = true, filename = "upload" } = body;
  const supabase = createAdminClient();

  // 1) map
  const drafts: ContactDraft[] = [];
  const byCategory: Record<string, number> = {};
  for (const r of rows) {
    const d = mapRow(presetId, r);
    if (!d) continue;
    drafts.push(d);
    const cat = d._category ?? "(none)";
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }

  const withEmail = drafts.filter((d) => d.email);
  const withoutEmail = drafts.filter((d) => !d.email);

  // 2) existing emails (batched .in)
  const emails = [...new Set(withEmail.map((d) => d.email!.toLowerCase()))];
  const existing = new Set<string>();
  for (const c of chunk(emails, 250)) {
    const { data } = await supabase.from("crm_contacts").select("email").in("email", c);
    for (const row of data ?? []) if (row.email) existing.add(row.email.toLowerCase());
  }
  const toInsert = withEmail.filter((d) => !existing.has(d.email!.toLowerCase()));
  const toMerge = withEmail.filter((d) => existing.has(d.email!.toLowerCase()));

  const report = {
    preset: presetId,
    total_rows: rows.length,
    mapped: drafts.length,
    new: toInsert.length,
    merged: toMerge.length,
    held_no_email: withoutEmail.length, // need org_name+name review — not auto-inserted
    unsegmented: drafts.filter((d) => !d.segment_code).length,
    by_category: byCategory,
    dry_run: dryRun,
  };

  if (dryRun) return NextResponse.json(report);

  // 3) org linkage (non-freemail domains)
  const domainToOrgId = await linkOrgs(supabase, toInsert);

  // 4) insert new contacts (with batch id)
  const { data: batch } = await supabase.from("crm_import_batches").insert({
    filename, source_kind: presetId, rows_total: rows.length,
    rows_imported: toInsert.length, rows_deduped: toMerge.length, rows_skipped: withoutEmail.length,
    mapping: { preset: presetId },
  }).select("id").single();
  const batchId = batch?.id ?? null;

  const inserted = { count: 0 };
  for (const c of chunk(toInsert, 500)) {
    const payload = c.map((d) => {
      const dom = d.email!.split("@")[1]?.toLowerCase() ?? "";
      return {
        org_id: !isFreemailDomain(d.email) ? domainToOrgId.get(dom) ?? null : null,
        segment_code: d.segment_code, name: d.name ?? null, org_name: d.org_name,
        role_title: d.role_title ?? null, country: d.country ?? null,
        jurisdiction: d.jurisdiction, kr_law_flag: d.kr_law_flag,
        email: d.email!.toLowerCase(), alt_emails: d.alt_emails ?? [],
        channel_type: d.channel_type, contact_url: d.contact_url ?? null,
        source_url: d.source_url ?? null, collected_at: d.collected_at || null,
        legal_basis: d.legal_basis ?? null, import_batch_id: batchId,
      };
    });
    const { error } = await supabase.from("crm_contacts").upsert(payload, { onConflict: "email", ignoreDuplicates: true });
    if (!error) inserted.count += c.length;
  }

  // 5) fill empty fields on email-matched dupes (cross-source, e.g. Variety)
  let filled = 0;
  for (const d of toMerge) {
    const { data: ex } = await supabase.from("crm_contacts").select("id, source_url, segment_code, role_title, country, tags").eq("email", d.email!.toLowerCase()).maybeSingle();
    if (!ex) continue;
    const patch: Record<string, unknown> = {};
    if (!ex.source_url && d.source_url) patch.source_url = d.source_url;
    if (!ex.segment_code && d.segment_code) patch.segment_code = d.segment_code;
    if (!ex.role_title && d.role_title) patch.role_title = d.role_title;
    if (!ex.country && d.country) patch.country = d.country;
    if (Object.keys(patch).length) { await supabase.from("crm_contacts").update(patch).eq("id", ex.id); filled++; }
  }

  await logContentEvent({
    entityType: "crm_import", entityId: String(batchId ?? 0), event: "imported", actorId: admin.id, actorKind: "human",
    meta: { preset: presetId, new: inserted.count, merged: filled },
  });

  return NextResponse.json({ ...report, dry_run: false, inserted: inserted.count, filled, batch_id: batchId });
}

async function linkOrgs(supabase: SupabaseClient, drafts: ContactDraft[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const domains = [...new Set(
    drafts.filter((d) => d.email && !isFreemailDomain(d.email)).map((d) => d.email!.split("@")[1].toLowerCase())
  )];
  if (!domains.length) return map;

  // existing
  for (const c of chunk(domains, 250)) {
    const { data } = await supabase.from("crm_orgs").select("id, domain").in("domain", c);
    for (const o of data ?? []) if (o.domain) map.set(o.domain.toLowerCase(), o.id);
  }
  // insert missing
  const missing = domains.filter((d) => !map.has(d));
  const nameByDomain = new Map<string, string>();
  for (const d of drafts) {
    if (!d.email || isFreemailDomain(d.email)) continue;
    const dom = d.email.split("@")[1].toLowerCase();
    if (!nameByDomain.has(dom)) nameByDomain.set(dom, d.org_name);
  }
  for (const c of chunk(missing, 300)) {
    const payload = c.map((dom) => ({ name: nameByDomain.get(dom) ?? dom, domain: dom, kind: "outlet" }));
    const { data } = await supabase.from("crm_orgs").upsert(payload, { onConflict: "domain", ignoreDuplicates: true }).select("id, domain");
    for (const o of data ?? []) if (o.domain) map.set(o.domain.toLowerCase(), o.id);
  }
  // re-fetch any that upsert-ignored (already existed via race) — best effort
  const still = missing.filter((d) => !map.has(d));
  for (const c of chunk(still, 250)) {
    const { data } = await supabase.from("crm_orgs").select("id, domain").in("domain", c);
    for (const o of data ?? []) if (o.domain) map.set(o.domain.toLowerCase(), o.id);
  }
  return map;
}
