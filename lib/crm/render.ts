/**
 * lib/crm/render.ts — the ONLY place outbound email bodies are assembled.
 * Invariant (§10-9): every message gets the unsubscribe line + physical address
 * footer, and every KR recipient gets a "(광고)" subject prefix — enforced HERE,
 * at the renderer, not in templates, so a template that forgets them stays safe.
 */
import type { CrmSettings } from "./types";

/**
 * Thrown by renderMessage when a legally-required footer field is missing, so a
 * non-compliant body can never be assembled/frozen. Callers must fail closed:
 * the rule engine skips the draft, the composer no-ops, the send job never runs.
 */
export class MissingComplianceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingComplianceError";
  }
}

export interface RenderContact {
  name?: string | null;
  org_name?: string | null;
  jurisdiction?: string | null;
  kr_law_flag?: boolean | null;
  metatake_url?: string | null;
}

export interface RenderTemplate {
  subject_tpl: string;
  body_tpl: string;
  language?: string | null;
}

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

export function renderMessage(
  tpl: RenderTemplate,
  contact: RenderContact,
  settings: CrmSettings,
  personalLine = ""
): { subject: string; body: string } {
  const lang = (tpl.language === "ko" ? "ko" : "en") as "ko" | "en";
  const vars: Record<string, string> = {
    name: (contact.name || contact.org_name || (lang === "ko" ? "담당자" : "there")).trim(),
    org: (contact.org_name || "").trim(),
    personal_line: (personalLine || "").trim(),
    metatake_url: (contact.metatake_url || "https://metatake.net").trim(),
  };

  let subject = fill(tpl.subject_tpl, vars).trim();
  let body = fill(tpl.body_tpl, vars).trim();

  // KR advertising label (정보통신망법 §50) — renderer-forced.
  const isKR = contact.jurisdiction === "KR" || !!contact.kr_law_flag;
  if (isKR && !subject.startsWith("(광고)")) {
    subject = `(광고) ${subject}`;
  }

  // Compliance footer — unsubscribe + physical address (CAN-SPAM §5(a)(5)).
  // §10-9: the postal address is legally required on every outbound body, so
  // refuse to assemble a message without it rather than silently ship a
  // non-compliant mail (the previous `filter(Boolean)` dropped a null address
  // and shipped an address-less footer). This is the single enforcement point;
  // every draft-creation path funnels through here.
  const addr = (settings.physical_address || "").trim();
  if (!addr) {
    throw new MissingComplianceError(
      "physical_address is not set — cannot render a CAN-SPAM-compliant message (§10-9). Set it in /crm/settings before composing or sending."
    );
  }
  const unsub = settings.unsubscribe_line?.[lang] ?? settings.unsubscribe_line?.en ?? "";
  const footerParts = [unsub, addr].filter(Boolean);
  body = `${body}\n\n—\n${footerParts.join("\n")}`;

  return { subject, body };
}

/**
 * Compute a send time inside the allowed window. KR recipients: clamp to the
 * KR window (default 08–21 KST). Others: return `from` unchanged (precise
 * timezones are intentionally out of scope — §5-5-C). Pure, so both the rule
 * evaluator (schedule) and the send job (re-check) use it.
 */
export function scheduleWithin(
  from: Date,
  contact: { jurisdiction?: string | null; kr_law_flag?: boolean | null },
  settings: CrmSettings
): Date {
  const isKR = contact.jurisdiction === "KR" || !!contact.kr_law_flag;
  if (!isKR) return from;

  const { start, end } = settings.kr_window ?? { start: 8, end: 21 };
  // KST is UTC+9 with no DST.
  const kstHour = (from.getUTCHours() + 9) % 24;
  if (kstHour >= start && kstHour < end) return from;

  // Move to next window start (today's `start` if before it, else tomorrow's).
  const d = new Date(from);
  const utcStart = (start - 9 + 24) % 24; // KST start hour → UTC hour
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(utcStart);
  if (d.getTime() <= from.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function inKrWindow(now: Date, settings: CrmSettings): boolean {
  const { start, end } = settings.kr_window ?? { start: 8, end: 21 };
  const kstHour = (now.getUTCHours() + 9) % 24;
  return kstHour >= start && kstHour < end;
}
