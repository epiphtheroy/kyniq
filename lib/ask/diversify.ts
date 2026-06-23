/**
 * ASK v2 · W3 (diversity policy) — Intent-driven diversification.
 *
 * Mirrors and improves v1's `diversify()` from `app/api/ask/route.ts`, but the
 * per-film cap is now DYNAMIC, driven by W2 intent:
 *   - "broad-concept" → MAX_PER_FILM = 2 (breadth, like v1): the model sees a
 *     wide spread of evidence, not three angles on one scene.
 *   - "specific-film" → relaxed cap (depth allowed): when the user asks about
 *     ONE work, multiple readings of that work are the point.
 *   - "multilingual" / "out-of-scope" → treated like broad-concept (breadth).
 *
 * Always: one take per figure; apply a relevance floor (drop rows clearly below
 * the bar); backfill ignoring caps if too few rows survive, so the model is
 * never starved.
 *
 * Input rows are assumed already ordered best-first (post-rerank). Each row
 * keeps its `rerankScore` if present; we re-number `rank` 1..N on output.
 */

import type { AskIntent } from "./queryUnderstanding";

export interface DiversifyRow {
  rank: number;
  take_id: string;
  rationale: string;
  register: string | null;
  theorist: string | null;
  film_title: string;
  film_slug: string;
  figure_label: string;
  figure_slug: string;
  meta_title: string | null;
  meta_slug: string | null;
  rrf: number;
  rerankScore?: number;
}

export interface DiversifyOptions {
  intent: AskIntent;
  /** Target number of rows to keep. Default 14 (matches v1 KEEP). */
  keep?: number;
  /**
   * Relevance floor on `rerankScore` (when present). Rows below are dropped
   * before diversification. Default 0 (no floor — rerank already floored).
   */
  floor?: number;
  /** Override the per-film cap (else derived from intent). */
  maxPerFilm?: number;
  /** Don't fall below this many rows; backfill ignoring caps if needed. */
  minKeep?: number;
}

/** Per-film cap derived from intent. */
export function capForIntent(intent: AskIntent, override?: number): number {
  if (typeof override === "number") return override;
  switch (intent) {
    case "specific-film":
      return 5; // allow depth on a single work (4–5 readings)
    case "broad-concept":
    case "multilingual":
    case "out-of-scope":
    default:
      return 2; // breadth, like v1
  }
}

export function diversify(
  cand: DiversifyRow[],
  opts: DiversifyOptions
): DiversifyRow[] {
  const keep = opts.keep ?? 14;
  const minKeep = opts.minKeep ?? 8;
  const maxPerFilm = capForIntent(opts.intent, opts.maxPerFilm);
  const floor = opts.floor ?? 0;

  // Apply relevance floor (only meaningful when rerankScore is present).
  const pool =
    floor > 0
      ? cand.filter((r) =>
          typeof r.rerankScore === "number" ? r.rerankScore >= floor : true
        )
      : cand;

  const source = pool.length > 0 ? pool : cand;

  const picked: DiversifyRow[] = [];
  const figSeen = new Set<string>();
  const filmCount = new Map<string, number>();

  for (const r of source) {
    const figKey = r.figure_slug || r.take_id;
    if (figSeen.has(figKey)) continue; // always one take per figure
    if ((filmCount.get(r.film_slug) ?? 0) >= maxPerFilm) continue;
    figSeen.add(figKey);
    filmCount.set(r.film_slug, (filmCount.get(r.film_slug) ?? 0) + 1);
    picked.push(r);
    if (picked.length >= keep) break;
  }

  // Backfill: if a sparse area or a strict cap starved us, relax the per-film
  // cap (but still respect one-take-per-figure) so we never under-feed the model.
  if (picked.length < minKeep) {
    for (const r of source) {
      if (picked.includes(r)) continue;
      const figKey = r.figure_slug || r.take_id;
      if (figSeen.has(figKey)) continue;
      figSeen.add(figKey);
      picked.push(r);
      if (picked.length >= Math.max(minKeep, Math.min(12, keep))) break;
    }
  }

  return picked.map((r, i) => ({ ...r, rank: i + 1 }));
}
