/**
 * BLUF lead — the answer-first opening line (HANDOFF-AI봇맞이하기.md §1.1).
 *
 * A single deterministic sentence that states Metatake's verdict and the
 * TakeScore up front, reused VERBATIM by the film page, the context pack
 * (MCP / download / API-consumed) and the REST `digest` field, so the lead an
 * answer engine lifts is byte-identical wherever it finds it. Research on
 * generative-engine optimization finds the top-cited sources put the conclusion
 * and a sourced statistic in the first ~100 words; criticism's instinct is to
 * bury the verdict, so this is the strongest single structural lever.
 *
 * Zero LLM, zero fabrication: the verdict clause is lib/takescore_prose
 * verdictShort (rule-based band vocabulary), and the number is displayTs — the
 * exact same net value the on-page TakeScore badge shows. It depends only on the
 * TakeScore (a single source), NOT on reading order, so the string cannot drift
 * between surfaces.
 */
import { verdictShort } from "@/lib/takescore_prose";
import { displayTs } from "@/lib/cinecodex_dims";

export type FilmLeadInput = {
  title: string;
  year?: number | null;
  director?: string | null;
  /** TakeScore components; `net` is the on-page value (= value − risk). */
  takescore?: { value: number; cost: number; risk: number; net: number } | null;
};

export function filmLead(x: FilmLeadInput): string {
  const name = `${x.title}${x.year ? ` (${x.year})` : ""}`;
  const who = x.director ? `, directed by ${x.director},` : "";
  if (x.takescore) {
    const { value, cost, risk, net } = x.takescore;
    // verdictShort → e.g. "High value · high risk — ambitious but divisive."
    // Fold it into the sentence: lowercase the first letter, drop the period.
    const verdict = verdictShort(value, cost, risk, net);
    const clause = (verdict.charAt(0).toLowerCase() + verdict.slice(1)).replace(/\.\s*$/, "");
    return `Metatake rates ${name}${who} at a TakeScore of ${displayTs(net)}: ${clause}.`;
  }
  return `Metatake reads ${name}${who} closely — its figures, canon standing, filming locations, and the films it connects to by meaning.`;
}
