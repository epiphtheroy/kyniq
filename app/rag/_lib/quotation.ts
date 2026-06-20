/**
 * Magazine quotation engine + fair-use guardrails (W8c).
 *
 * Legal posture (US fair-use "quotation in criticism", per counsel): the answer
 * may weave in SHORT, attributed quotes from allow-listed magazine passages, but
 * never reproduce substantial text and never substitute for the original. These
 * guardrails enforce that MECHANICALLY so the policy can't drift:
 *
 *   1. clampQuote        — cap any quote to a few words / 1–2 sentences.
 *   2. quotedFraction    — measure how much of the answer is quoted (cap it).
 *   3. verbatimViolations— detect long contiguous overlaps with sources that are
 *                          NOT short marked quotes (i.e. over-reproduction).
 *   4. attribution       — every quote carries outlet · author + a link-out.
 *   5. quotationContract — the system-prompt rules handed to the LLM.
 *
 * These thresholds are the knobs counsel can set; defaults are conservative.
 * Nothing here stores or returns full article text — only short, stored snippets.
 */

export interface MagazinePassage {
  id: string;
  outlet: string;
  title: string | null;
  author: string | null;
  year: number | null;
  url: string;
  /** SHORT stored excerpt only (fair-use sized) — never the full article. */
  snippet: string;
}

export interface QuotePolicy {
  /** Max words allowed inside a single quote. */
  maxWords: number;
  /** Max sentences inside a single quote. */
  maxSentences: number;
  /** Max fraction of the whole answer that may be quoted text (0..1). */
  maxQuotedFraction: number;
  /** Contiguous matching word-run with a source that counts as over-reproduction. */
  guardNgram: number;
}

/** Conservative defaults — counsel can tune these in one place. */
export const DEFAULT_QUOTE_POLICY: QuotePolicy = {
  maxWords: 28,
  maxSentences: 2,
  maxQuotedFraction: 0.18,
  guardNgram: 12,
};

// ── tokenization ──────────────────────────────────────────────────────
function words(s: string): string[] {
  return (s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
}

/** Clamp a candidate quote to the policy (word + sentence caps). Returns a quote
 *  ready to be wrapped in quotation marks, or "" if nothing usable. */
export function clampQuote(text: string, policy: QuotePolicy = DEFAULT_QUOTE_POLICY): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  // sentence cap first
  const sentences = clean.match(/[^.!?]+[.!?]?/g) ?? [clean];
  let out = sentences.slice(0, policy.maxSentences).join(" ").trim();
  // then word cap
  const w = out.split(/\s+/);
  if (w.length > policy.maxWords) out = w.slice(0, policy.maxWords).join(" ").replace(/[,;:]$/, "") + "…";
  return out.trim();
}

/** Formatted attribution + link for a passage. */
export function attribution(p: MagazinePassage): { label: string; url: string } {
  const bits = [p.author, p.outlet, p.year != null ? String(p.year) : null].filter(Boolean);
  return { label: bits.join(", ") || p.outlet || "source", url: p.url };
}

/** Fraction of the answer that sits inside quotation marks (straight or curly). */
export function quotedFraction(answer: string): number {
  const total = words(answer).length || 1;
  const quoted = [...(answer.match(/["“]([^"”]+)["”]/g) ?? [])]
    .reduce((n, q) => n + words(q).length, 0);
  return Math.min(1, quoted / total);
}

export interface VerbatimViolation {
  passageId: string;
  outlet: string;
  overlapWords: number;
  excerpt: string;
}

/**
 * Find the longest contiguous word-run shared between the answer and each source
 * passage. A run longer than `guardNgram` signals over-reproduction (more than a
 * short quote) and is flagged so the caller can regenerate or trim. This catches
 * the failure mode where the model pastes a sentence/paragraph verbatim.
 */
export function verbatimViolations(
  answer: string,
  passages: MagazinePassage[],
  policy: QuotePolicy = DEFAULT_QUOTE_POLICY
): VerbatimViolation[] {
  const a = words(answer);
  const out: VerbatimViolation[] = [];
  for (const p of passages) {
    const s = words(p.snippet);
    if (s.length === 0 || a.length === 0) continue;
    const sSet = new Set(s.map((_, i) => s.slice(i, i + policy.guardNgram).join(" ")));
    let longest = 0;
    let at = -1;
    // slide an n-gram window of the answer; if it appears in the source, try to extend
    for (let i = 0; i + policy.guardNgram <= a.length; i++) {
      const gram = a.slice(i, i + policy.guardNgram).join(" ");
      if (sSet.has(gram)) {
        // extend the match as far as it continues
        let len = policy.guardNgram;
        const sStart = s.findIndex((_, j) => s.slice(j, j + policy.guardNgram).join(" ") === gram);
        while (
          sStart + len < s.length && i + len < a.length && a[i + len] === s[sStart + len]
        ) len++;
        if (len > longest) { longest = len; at = i; }
      }
    }
    if (longest > policy.guardNgram) {
      out.push({
        passageId: p.id,
        outlet: p.outlet,
        overlapWords: longest,
        excerpt: a.slice(at, at + Math.min(longest, 20)).join(" ") + (longest > 20 ? "…" : ""),
      });
    }
  }
  return out;
}

/** True if the answer respects all quote guardrails for the given sources. */
export function quotesAreClean(
  answer: string,
  passages: MagazinePassage[],
  policy: QuotePolicy = DEFAULT_QUOTE_POLICY
): boolean {
  return quotedFraction(answer) <= policy.maxQuotedFraction
    && verbatimViolations(answer, passages, policy).length === 0;
}

/** System-prompt contract handed to the LLM when magazine passages are in context. */
export function quotationContract(policy: QuotePolicy = DEFAULT_QUOTE_POLICY): string {
  return [
    "When you draw on a CRITIC passage (marked [C#]):",
    `- Quote at most ${policy.maxSentences} sentence(s) / ~${policy.maxWords} words, inside quotation marks.`,
    "- Attribute every quote in-line to its outlet and author, e.g. (“…” — Author, Outlet).",
    "- When a CRITIC passage is directly relevant to the question, include at most ONE short attributed quote and mark it [C#]; otherwise paraphrase or omit. Never reproduce a paragraph or stitch quotes together.",
    "- Critic passages are secondary: your own analysis and the corpus close-readings lead.",
    "- Never present a critic's wording as the corpus's, and keep their [C#] markers distinct from corpus [n].",
  ].join("\n");
}
