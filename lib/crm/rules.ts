/**
 * lib/crm/rules.ts — the scheduling-rule evaluator (§5-5). Called by the cron
 * (job ①). Reads contact history (crm_touches) and produces DRAFTS ONLY — never
 * sends. Every hard filter in §5-5-C is enforced here; a rule cannot opt out.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmSettings } from "./types";
import { liaOk } from "./types";
import { renderMessage, scheduleWithin } from "./render";

// Stages a rule may NEVER target — a reply/close means a human takes over (§10-5).
const HARD_EXCLUDE_STAGES = new Set(["replied", "negotiating", "won", "unsubscribed", "bounced"]);

interface RuleRow {
  id: number;
  name: string;
  enabled: boolean;
  match: {
    segment_codes?: string[];
    jurisdictions?: string[];
    stages?: string[];
    parked_reason?: string;
    require_email?: boolean;
    exclude_tags?: string[];
  };
  trigger: { kind?: string; days_since_last_touch?: number; max_total_touches?: number };
  action: { kind?: string; draft_kind?: string; offer_id?: number | null; template_id?: number | null };
  caps: { per_run?: number; per_day?: number };
  priority: number;
}

interface TemplateRow {
  id: number;
  segment_code: string | null;
  kind: string;
  language: string | null;
  subject_tpl: string;
  body_tpl: string;
  non_commercial: boolean;
}

export interface RuleRunSummary {
  rule_id: number;
  name: string;
  matched: number;
  drafted: number;
  skipped_suppressed: number;
  skipped_capped: number;
  error?: string;
}

export async function evaluateRules(supabase: SupabaseClient, settings: CrmSettings): Promise<RuleRunSummary[]> {
  const { data: rules } = await supabase
    .from("crm_rules")
    .select("*")
    .eq("enabled", true)
    .order("priority", { ascending: true });

  if (!rules?.length) return [];

  // Shared reference data loaded once.
  const { data: supp } = await supabase.from("crm_suppression").select("email, domain");
  const suppEmails = new Set((supp ?? []).map((s) => (s.email ?? "").toLowerCase()).filter(Boolean));
  const suppDomains = new Set((supp ?? []).map((s) => (s.domain ?? "").toLowerCase()).filter(Boolean));

  const { data: templates } = await supabase.from("crm_templates").select("*");
  const tplById = new Map<number, TemplateRow>((templates ?? []).map((t: TemplateRow) => [t.id, t]));
  const tplByKind = (kind: string, seg: string | null): TemplateRow | undefined =>
    (templates ?? []).find((t: TemplateRow) => t.kind === kind && (seg ? t.segment_code === seg : !t.segment_code)) ??
    (templates ?? []).find((t: TemplateRow) => t.kind === kind);

  const summaries: RuleRunSummary[] = [];

  for (const rule of rules as RuleRow[]) {
    const s: RuleRunSummary = { rule_id: rule.id, name: rule.name, matched: 0, drafted: 0, skipped_suppressed: 0, skipped_capped: 0 };
    try {
      const action = rule.action ?? {};
      const draftKind = action.draft_kind ?? "first";

      // Resolve the template: explicit id, else by kind + segment.
      const firstSeg = rule.match.segment_codes?.[0] ?? null;
      const tpl = action.template_id ? tplById.get(action.template_id) : tplByKind(draftKind, firstSeg);
      if (!tpl) throw new Error("no template resolved");

      // per_day cap: drafts this rule already created today.
      const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
      const { count: madeToday } = await supabase
        .from("crm_drafts").select("*", { count: "exact", head: true })
        .eq("rule_id", rule.id).gte("created_at", todayStart.toISOString());
      const perDay = rule.caps?.per_day ?? 20;
      const perRun = rule.caps?.per_run ?? 10;
      let budget = Math.max(0, Math.min(perRun, perDay - (madeToday ?? 0)));
      if (budget === 0) { s.skipped_capped = 1; summaries.push(s); continue; }

      // Candidate query from match.
      let q = supabase.from("crm_contacts").select("*").limit(400);
      if (rule.match.segment_codes?.length) q = q.in("segment_code", rule.match.segment_codes);
      if (rule.match.stages?.length) q = q.in("stage", rule.match.stages);
      if (rule.match.jurisdictions?.length) q = q.in("jurisdiction", rule.match.jurisdictions);
      if (rule.match.require_email) q = q.not("email", "is", null);
      const { data: contacts } = await q;
      if (!contacts?.length) { summaries.push(s); continue; }

      const ids = contacts.map((c) => c.id);

      // Bulk-load: existing open drafts + out-touch counts for this candidate set.
      const { data: openDrafts } = await supabase
        .from("crm_drafts").select("contact_id").in("contact_id", ids).in("status", ["proposed", "approved", "queued"]);
      const hasOpenDraft = new Set((openDrafts ?? []).map((d) => d.contact_id));

      const { data: outTouches } = await supabase
        .from("crm_touches").select("contact_id").in("contact_id", ids).eq("direction", "out").in("kind", ["first", "followup"]);
      const touchCount = new Map<number, number>();
      for (const t of outTouches ?? []) touchCount.set(t.contact_id, (touchCount.get(t.contact_id) ?? 0) + 1);

      const followupMax = settings.followup_max ?? 2;
      const maxTouches = Math.min(rule.trigger?.max_total_touches ?? 999, followupMax + 1);
      const ageDays = rule.trigger?.days_since_last_touch ?? 0;
      const now = new Date();

      for (const c of contacts) {
        if (budget <= 0) break;
        s.matched++;

        // ── hard filters (order matters for the counters) ──
        const email = (c.email ?? "").toLowerCase();
        const domain = email.split("@")[1] ?? "";
        if (email && (suppEmails.has(email) || (domain && suppDomains.has(domain)))) { s.skipped_suppressed++; continue; }
        if (HARD_EXCLUDE_STAGES.has(c.stage)) continue;
        if (c.parked_reason === "negative_reply") continue;
        if (rule.match.parked_reason && c.stage === "parked" && c.parked_reason !== rule.match.parked_reason) continue;
        if (!liaOk(c)) continue;
        // KR/CA consent gate.
        if ((c.jurisdiction === "KR" || c.kr_law_flag) && c.consent_status !== "granted") continue;
        if (c.jurisdiction === "CA" && c.consent_status !== "granted" && !(c.tags ?? []).includes("casl-exempt")) continue;
        // Academic/education segments: non-commercial template only.
        if (/^[EG]/.test(c.segment_code ?? "") && !tpl.non_commercial) throw new Error(`commercial template on ${c.segment_code}`);
        // exclude_tags overlap.
        if (rule.match.exclude_tags?.some((t) => (c.tags ?? []).includes(t))) continue;
        // already has an open draft.
        if (hasOpenDraft.has(c.id)) continue;
        // follow-up ceiling.
        if ((touchCount.get(c.id) ?? 0) >= maxTouches) continue;
        // trigger: stage_age (the only implemented kind).
        const anchor = c.last_touch_at ?? c.created_at;
        const age = (now.getTime() - new Date(anchor).getTime()) / 86_400_000;
        if (age < ageDays) continue;

        // ── create the draft ──
        const { subject, body } = renderMessage(tpl, c, settings, "");
        const scheduledFor = scheduleWithin(now, c, settings);
        const { error } = await supabase.from("crm_drafts").insert({
          contact_id: c.id,
          rule_id: rule.id,
          offer_id: action.offer_id ?? null,
          template_id: tpl.id,
          kind: draftKind,
          subject,
          body,
          status: "proposed",
          created_by: "rule",
          scheduled_for: scheduledFor.toISOString(),
        });
        if (!error) { s.drafted++; budget--; }
      }
    } catch (e) {
      s.error = e instanceof Error ? e.message : String(e);
    }

    // Ledger row + last_run stamp.
    await supabase.from("crm_rule_runs").insert({
      rule_id: rule.id, matched: s.matched, drafted: s.drafted,
      skipped_suppressed: s.skipped_suppressed, skipped_capped: s.skipped_capped, errors: s.error ?? null,
    });
    await supabase.from("crm_rules").update({ last_run_at: new Date().toISOString() }).eq("id", rule.id);
    summaries.push(s);
  }

  return summaries;
}
