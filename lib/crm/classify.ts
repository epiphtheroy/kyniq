/**
 * lib/crm/classify.ts — rule-based inbound classifier (§5-7). Regex-first;
 * an LLM sub-split of positive/question is optional and out of this module.
 * Pure: takes message fields, returns a classification. The cron job applies
 * the side effects (suppression insert, stage transitions, auto-draft).
 */

export type InboundClass =
  | "bounce" | "unsubscribe" | "auto_ooo" | "negative" | "positive" | "question";

const RE_BOUNCE_FROM = /mailer-daemon|postmaster/i;
const RE_BOUNCE_SUBJ = /delivery status|undeliverable|delivery failure|returned mail|mail delivery failed/i;
const RE_UNSUB = /unsubscribe|remove me|opt.?out|stop email|take me off|수신\s*거부|구독\s*취소|수신을 원치/i;
const RE_OOO = /out of office|auto.?reply|autoreply|automatic reply|on vacation|away from|부재중|자동\s*응답|휴가/i;
const RE_NEGATIVE = /not interested|no thank|no,? thanks|please don'?t|unfortunately we|not a fit|관심\s*없|사양하겠|해당\s*없/i;

export function classifyInbound(input: { from: string; subject: string; snippet: string }): InboundClass {
  const from = (input.from || "").toLowerCase();
  const hay = `${input.subject || ""}\n${input.snippet || ""}`;

  if (RE_BOUNCE_FROM.test(from) || RE_BOUNCE_SUBJ.test(input.subject || "")) return "bounce";
  if (RE_UNSUB.test(hay)) return "unsubscribe";
  if (RE_OOO.test(hay)) return "auto_ooo";
  if (RE_NEGATIVE.test(hay)) return "negative";
  // Default: a real reply worth a human's eye. A cheap positive/question hint —
  // a question mark leans "question"; everything else "positive". (LLM refine optional.)
  return /\?|질문|궁금|알려주|문의/.test(hay) ? "question" : "positive";
}

/** Does this class create an auto-reply draft? (positive/question only.) */
export function classGetsAutoReply(c: InboundClass): boolean {
  return c === "positive" || c === "question";
}
