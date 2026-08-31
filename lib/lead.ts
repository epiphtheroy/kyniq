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
 *
 * LOCALE (2026-08-31). `locale` is optional and defaults to English, so the
 * machine-readable surfaces — lib/pack.ts (MCP / download) and lib/apiv1.ts
 * (`digest`) — keep emitting byte-identical English without being touched. Only
 * the rendered film page passes a locale. The byte-identical contract therefore
 * holds PER LOCALE, which is the only reading of it that survives translation:
 * one string per (film, locale), the same wherever that locale is served.
 *
 * The sentence is assembled from whole templates rather than concatenated
 * fragments. A previous attempt at localised prose in CinecodexPanel glued six
 * t() calls together and produced word salad in Korean, which is SOV; word order
 * is the translator's to choose, so the whole sentence has to be theirs.
 */
import { verdictShort } from "@/lib/takescore_prose";
import { displayTs } from "@/lib/cinecodex_dims";
import { t, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export type FilmLeadInput = {
  title: string;
  year?: number | null;
  director?: string | null;
  /** TakeScore components; `net` is the on-page value (= value − risk). */
  takescore?: { value: number; cost: number; risk: number; net: number } | null;
};

export function filmLead(x: FilmLeadInput, locale: Locale = DEFAULT_LOCALE): string {
  const name = `${x.title}${x.year ? ` (${x.year})` : ""}`;
  if (x.takescore) {
    const { value, cost, risk, net } = x.takescore;
    // verdictShort → e.g. "High value · high risk — ambitious but divisive."
    const verdict = t(locale, verdictShort(value, cost, risk, net));
    // Fold it into the sentence: drop the full stop, and — in English only —
    // lower-case the opening letter. Hangul has no case, so running that on
    // Korean is a no-op dressed up as a rule; better to say so than to imply
    // every language cases its sentences the way English does.
    const bare = verdict.replace(/\.\s*$/, "");
    const clause = locale === DEFAULT_LOCALE ? bare.charAt(0).toLowerCase() + bare.slice(1) : bare;
    const score = String(displayTs(net));
    return x.director
      ? t(locale, "Metatake rates {name}, directed by {director}, at a TakeScore of {score}: {clause}.", { name, director: x.director, score, clause })
      : t(locale, "Metatake rates {name} at a TakeScore of {score}: {clause}.", { name, score, clause });
  }
  return x.director
    ? t(locale, "Metatake reads {name}, directed by {director}, closely — its figures, canon standing, filming locations, and the films it connects to by meaning.", { name, director: x.director })
    : t(locale, "Metatake reads {name} closely — its figures, canon standing, filming locations, and the films it connects to by meaning.", { name });
}
