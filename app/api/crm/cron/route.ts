/**
 * /api/crm/cron — hourly CRM cron (vercel.json). Piggybacks 5 isolated jobs
 * (§5-5-A): ① rule evaluation → ② Gmail sync (sent+inbox) → ③ inbound classify
 * → ④ due-action flag → ⑤ (P3, opt-in) send queued drafts within caps.
 *
 * Auth (house pattern): x-vercel-cron header OR ?key=REVALIDATION_SECRET OR admin.
 * 20-min marker guard makes stray triggers harmless. ?force skips the guard.
 * ?backfill=N runs the Gmail sync over the last N days (retroactive reconcile).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSettings, saveSettings } from "@/lib/crm/settings";
import { evaluateRules, HARD_EXCLUDE_STAGES } from "@/lib/crm/rules";
import { classifyInbound, classGetsAutoReply } from "@/lib/crm/classify";
import { renderMessage, inKrWindow } from "@/lib/crm/render";
import {
  listMessageIds, getMessageMeta, parseEmail, sendDraft, GmailAuthError,
} from "@/lib/crm/gmail";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmSettings } from "@/lib/crm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MIN_INTERVAL_MS = 20 * 60 * 1000;

export async function GET(req: NextRequest) {
  const fromCron =
    req.headers.get("x-vercel-cron") !== null ||
    (req.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  const key = req.nextUrl.searchParams.get("key");
  const keyOk = !!key && key === process.env.REVALIDATION_SECRET;
  if (!fromCron && !keyOk) {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const force = req.nextUrl.searchParams.get("force") !== null;
  const backfillDays = Number(req.nextUrl.searchParams.get("backfill") ?? "0") || 0;

  // 20-min guard via a marker row in crm_rule_runs (rule_id = null = marker).
  if (!force && !backfillDays) {
    const { data: last } = await supabase
      .from("crm_rule_runs").select("started_at").is("rule_id", null)
      .order("started_at", { ascending: false }).limit(1);
    const lastTs = last?.[0]?.started_at ? new Date(last[0].started_at).getTime() : 0;
    if (Date.now() - lastTs < MIN_INTERVAL_MS) {
      return NextResponse.json({ skipped: true, last_run: last?.[0]?.started_at });
    }
  }

  const settings = await loadSettings(supabase);
  const result: Record<string, unknown> = {};

  // ① rule evaluation
  try { result.rules = await evaluateRules(supabase, settings); }
  catch (e) { result.rules_error = errMsg(e); }

  // ② Gmail sync (sent + inbox)
  try { result.sync = await gmailSync(supabase, settings, backfillDays || 3); }
  catch (e) {
    if (e instanceof GmailAuthError) { await saveSettings(supabase, { gmail_token_error: true }); result.sync_error = "gmail_auth"; }
    else result.sync_error = errMsg(e);
  }

  // ③ inbound classification
  try { result.classify = await classifyInbox(supabase, settings); }
  catch (e) { result.classify_error = errMsg(e); }

  // ④ due-action flag (no mutation needed — dashboard reads next_action_at directly)

  // ⑤ send execution (P3, opt-in)
  if (settings.system_send_enabled) {
    try { result.send = await sendQueued(supabase, settings); }
    catch (e) {
      if (e instanceof GmailAuthError) { await saveSettings(supabase, { gmail_token_error: true }); result.send_error = "gmail_auth"; }
      else result.send_error = errMsg(e);
    }
  }

  // marker row
  await supabase.from("crm_rule_runs").insert({ rule_id: null, matched: 0, drafted: 0 });
  return NextResponse.json(result);
}

function errMsg(e: unknown): string { return e instanceof Error ? e.message : String(e); }

// ── ② Gmail sync ─────────────────────────────────────────────────────────────
async function gmailSync(supabase: SupabaseClient, _settings: CrmSettings, sinceDays: number) {
  let sentMatched = 0, inboundNew = 0;

  // SENT: match by threadId to open drafts (approved/queued/sent-pending) → mark sent.
  const sentIds = await listMessageIds(`in:sent newer_than:${sinceDays}d`, 100);
  for (const m of sentIds) {
    const { data: draft } = await supabase
      .from("crm_drafts").select("*").eq("gmail_thread_id", m.threadId)
      .in("status", ["approved", "queued"]).limit(1).maybeSingle();
    if (!draft) continue;
    const meta = await getMessageMeta(m.id);
    await markDraftSent(supabase, draft, meta.id, m.threadId);
    sentMatched++;
  }

  // INBOX: upsert into crm_inbound, match contact by from-email.
  const inboxIds = await listMessageIds(`in:inbox newer_than:${sinceDays}d`, 100);
  for (const m of inboxIds) {
    const { data: exists } = await supabase.from("crm_inbound").select("id").eq("gmail_message_id", m.id).maybeSingle();
    if (exists) continue;
    const meta = await getMessageMeta(m.id);
    const from = parseEmail(meta.from);
    const { data: contact } = await supabase
      .from("crm_contacts").select("id").or(`email.eq.${from},alt_emails.cs.{${from}}`).limit(1).maybeSingle();
    await supabase.from("crm_inbound").insert({
      contact_id: contact?.id ?? null,
      gmail_message_id: meta.id, gmail_thread_id: meta.threadId,
      from_email: from, subject: meta.subject, snippet: meta.snippet,
      classified_as: contact ? null : "unmatched",
      received_at: new Date(meta.internalDate || Date.now()).toISOString(),
    });
    inboundNew++;
  }

  return { sentMatched, inboundNew };
}

async function markDraftSent(supabase: SupabaseClient, draft: Record<string, unknown>, messageId: string, threadId: string) {
  await supabase.from("crm_drafts").update({
    status: "sent", sent_message_id: messageId, gmail_thread_id: threadId, updated_at: new Date().toISOString(),
  }).eq("id", draft.id);

  const kind = draft.kind as string;
  const touchKind = kind === "reply" ? "reply_out" : kind; // first | followup | reply_out
  await supabase.from("crm_touches").insert({
    contact_id: draft.contact_id, direction: "out", channel: "gmail", kind: touchKind,
    rule_id: draft.rule_id ?? null, offer_id: draft.offer_id ?? null, draft_id: draft.id,
    subject: draft.subject, gmail_message_id: messageId, gmail_thread_id: threadId,
  });

  // stage transition (only forward; never regress a replied/won contact)
  const { data: c } = await supabase.from("crm_contacts").select("stage").eq("id", draft.contact_id).maybeSingle();
  const cur = c?.stage as string | undefined;
  let next: string | null = null;
  if (kind === "first" && cur === "none") next = "first_sent";
  else if (kind === "followup" && (cur === "first_sent" || cur === "none")) next = "followup";
  const patch: Record<string, unknown> = { last_touch_at: new Date().toISOString() };
  if (next) patch.stage = next;
  await supabase.from("crm_contacts").update(patch).eq("id", draft.contact_id);
}

// ── ③ inbound classification ─────────────────────────────────────────────────
async function classifyInbox(supabase: SupabaseClient, settings: CrmSettings) {
  const { data: rows } = await supabase
    .from("crm_inbound").select("*").is("classified_as", null).eq("handled", false).limit(50);
  if (!rows?.length) return { classified: 0 };

  let n = 0;
  for (const r of rows) {
    const cls = classifyInbound({ from: r.from_email, subject: r.subject ?? "", snippet: r.snippet ?? "" });
    const patch: Record<string, unknown> = { classified_as: cls };
    const contactId = r.contact_id as number | null;

    if (cls === "bounce" && contactId) {
      await supabase.from("crm_contacts").update({ verify_status: "bounced", stage: "bounced" }).eq("id", contactId);
      await touchIn(supabase, contactId, "bounce", r);
      patch.handled = true;
    } else if (cls === "unsubscribe") {
      const email = r.from_email as string;
      await supabase.from("crm_suppression").upsert({ email: email.toLowerCase(), reason: "unsubscribe", source: "inbound_reply" }, { onConflict: "email" });
      if (contactId) {
        await supabase.from("crm_contacts").update({ stage: "unsubscribed" }).eq("id", contactId);
        await touchIn(supabase, contactId, "unsub", r);
      }
      patch.handled = true;
    } else if (cls === "auto_ooo" && contactId) {
      const next = new Date(Date.now() + 7 * 86400_000).toISOString();
      await supabase.from("crm_contacts").update({ next_action_at: next }).eq("id", contactId);
      patch.handled = true;
    } else if (cls === "negative" && contactId) {
      await supabase.from("crm_contacts").update({
        stage: "parked", parked_reason: "negative_reply", next_action_at: new Date(Date.now() + 90 * 86400_000).toISOString(),
      }).eq("id", contactId);
      await touchIn(supabase, contactId, "reply_in", r);
      patch.handled = true;
    } else if (classGetsAutoReply(cls) && contactId) {
      // stage → replied (only from first_sent/followup)
      const { data: c } = await supabase.from("crm_contacts").select("stage, name, org_name, jurisdiction, kr_law_flag, metatake_url, segment_code").eq("id", contactId).maybeSingle();
      if (c && (c.stage === "first_sent" || c.stage === "followup")) {
        await supabase.from("crm_contacts").update({ stage: "replied" }).eq("id", contactId);
      }
      await touchIn(supabase, contactId, "reply_in", r);
      // auto-reply draft (proposed). §10-9: skip if no physical address is set —
      // renderMessage would (correctly) throw, and this job must not crash.
      const { data: tpl } = await supabase.from("crm_templates").select("*").eq("kind", "reply").limit(1).maybeSingle();
      if (tpl && c && settings.physical_address) {
        const { subject, body } = renderMessage(tpl, c, settings, "");
        const { data: d } = await supabase.from("crm_drafts").insert({
          contact_id: contactId, template_id: tpl.id, kind: "reply", subject: `Re: ${r.subject ?? ""}`.slice(0, 200) || subject,
          body, status: "proposed", created_by: "rule", gmail_thread_id: r.gmail_thread_id,
        }).select("id").maybeSingle();
        if (d) patch.auto_draft_id = d.id;
      }
      // leave handled=false → shows in /crm/inbox for human review
    }

    await supabase.from("crm_inbound").update(patch).eq("id", r.id);
    n++;
  }
  return { classified: n };
}

async function touchIn(supabase: SupabaseClient, contactId: number, kind: string, r: Record<string, unknown>) {
  await supabase.from("crm_touches").insert({
    contact_id: contactId, direction: "in", channel: "gmail", kind,
    subject: r.subject ?? null, snippet: r.snippet ?? null,
    gmail_message_id: r.gmail_message_id, gmail_thread_id: r.gmail_thread_id,
  });
  await supabase.from("crm_contacts").update({ last_touch_at: new Date().toISOString() }).eq("id", contactId);
}

// ── ⑤ send queued (P3) ───────────────────────────────────────────────────────
async function sendQueued(supabase: SupabaseClient, settings: CrmSettings) {
  // bounce circuit breaker
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { count: sent7 } = await supabase.from("crm_touches").select("*", { count: "exact", head: true })
    .eq("direction", "out").in("kind", ["first", "followup"]).gte("happened_at", since7);
  const { count: bounce7 } = await supabase.from("crm_touches").select("*", { count: "exact", head: true })
    .eq("kind", "bounce").gte("happened_at", since7);
  if ((sent7 ?? 0) >= settings.bounce_rate_window && (bounce7 ?? 0) / (sent7 ?? 1) > settings.bounce_rate_threshold) {
    await saveSettings(supabase, { system_send_enabled: false });
    return { halted: "bounce_rate", sent7, bounce7 };
  }

  // caps: daily + weekly remaining
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const { count: sentToday } = await supabase.from("crm_drafts").select("*", { count: "exact", head: true })
    .eq("status", "sent").gte("updated_at", dayStart.toISOString());
  const { count: sentWeek } = await supabase.from("crm_drafts").select("*", { count: "exact", head: true })
    .eq("status", "sent").gte("updated_at", since7);
  let budget = Math.min(
    settings.per_cron_send_cap,
    settings.daily_send_cap - (sentToday ?? 0),
    settings.weekly_send_cap - (sentWeek ?? 0),
  );
  if (budget <= 0) return { sent: 0, capped: true };

  const { data: drafts } = await supabase
    .from("crm_drafts").select("*").eq("status", "queued").lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true }).limit(budget);
  if (!drafts?.length) return { sent: 0 };

  // suppression snapshot
  const { data: supp } = await supabase.from("crm_suppression").select("email, domain");
  const suppE = new Set((supp ?? []).map((s) => (s.email ?? "").toLowerCase()).filter(Boolean));
  const suppD = new Set((supp ?? []).map((s) => (s.domain ?? "").toLowerCase()).filter(Boolean));

  let sent = 0;
  const now = new Date();
  for (const d of drafts) {
    if (budget <= 0) break;
    const { data: c } = await supabase.from("crm_contacts").select("*").eq("id", d.contact_id).maybeSingle();
    if (!c || !c.email) { await failDraft(supabase, d.id, "no email"); continue; }
    const email = c.email.toLowerCase(); const dom = email.split("@")[1] ?? "";
    if (suppE.has(email) || (dom && suppD.has(dom))) { await failDraft(supabase, d.id, "suppressed"); continue; }
    // §10-5: re-check the SAME permanent-exclusion set the rule engine uses, at
    // send time — inbound classify (job ③) can flip a contact to replied/parked
    // within this very run, so a queued draft must not ship to someone who just
    // replied or declined. (Previously this only caught unsubscribed/bounced/won.)
    if (HARD_EXCLUDE_STAGES.has(c.stage) || c.parked_reason === "negative_reply") {
      await failDraft(supabase, d.id, `stage ${c.stage}${c.parked_reason ? `/${c.parked_reason}` : ""}`);
      continue;
    }
    if ((c.jurisdiction === "KR" || c.kr_law_flag) && !inKrWindow(now, settings)) continue; // defer to a later run
    try {
      if (!d.gmail_draft_id) { await failDraft(supabase, d.id, "no gmail_draft_id"); continue; }
      const res = await sendDraft(d.gmail_draft_id);
      await markDraftSent(supabase, d, res.messageId, res.threadId);
      sent++; budget--;
    } catch (e) {
      if (e instanceof GmailAuthError) throw e;
      await failDraft(supabase, d.id, errMsg(e));
    }
  }
  return { sent };
}

async function failDraft(supabase: SupabaseClient, id: number, error: string) {
  await supabase.from("crm_drafts").update({ status: "failed", error, updated_at: new Date().toISOString() }).eq("id", id);
}
