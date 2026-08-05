import { bandWordLabel, verdictLabel } from "../i18n/tokens";
// TakeScore prose — a straight port of the website's lib/takescore_prose.ts.
//
// Deterministic band tables that turn the V/C/R numbers already on the film
// brief into words. No randomness, no LLM: same numbers in, same sentence out.
// Band index = clamp(1..5, round(score/20)) — the same step the private
// Appraisal uses, so public, private, web and app all land on the same word.
//
// Kept as a module rather than i18n keys, and deliberately English: these are
// the site's published vocabulary for the score (the same words /takescore/film
// prints), so the app must not drift from them. If the UI ever goes
// multilingual, translate this table and lib/takescore_prose.ts together — one
// without the other would make the same film read two different verdicts.
export type Axis = "value" | "cost" | "risk";

export const BAND_WORDS: Record<Axis, [string, string, string, string, string]> = {
  value: ["Faint traces", "Fair returns", "Solid, not peak", "Strong, lasting", "Exceptional — canon-grade"],
  cost: ["Walk right in", "Some homework", "Real preparation", "Advanced viewing", "Expert terrain"],
  risk: ["Nearly riskless", "Low downside", "Some hazard", "High letdown risk", "Severe — a gamble"],
};

/** 1..5 band step, identical to the web's bandOf / EvalCard's lvOf. */
export function bandOf(score: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(score / 20))) as 1 | 2 | 3 | 4 | 5;
}

export function bandWord(axis: Axis, score: number): string {
  const step = bandOf(score);
  // English stays the source of truth (and the fallback); the projection is
  // render-time only — these strings are never sent to the BFF.
  return bandWordLabel(axis, step, BAND_WORDS[axis][step - 1]);
}

/**
 * The quadrant verdict — what V against R means for this film.
 * Thresholds match the private Appraisal: high value ≥ 72, low risk ≤ 20.
 */
export function verdictShort(v: number, r: number): string {
  const hiV = Math.round(v) >= 72;
  const loR = Math.round(r) <= 20;
  if (hiV && loR) return verdictLabel(0, "High value · low risk — a safe masterpiece.");
  if (hiV) return verdictLabel(1, "High value · high risk — ambitious but divisive.");
  if (loR) return verdictLabel(2, "Solid but not peak — a stable choice.");
  return verdictLabel(3, "Mid value, mid risk — approach with care.");
}
