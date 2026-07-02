import type { Metadata } from "next";

/**
 * SITE_INDEXABLE — master switch for whether search engines may index/evaluate
 * the site. Keep this FALSE while the corpus is being enriched, so Google does
 * not assess us as thin/scaled content before we are ready. Flip to true (then
 * deploy) once figures are enriched (≥3 takes) and the catalogue is launch-ready.
 */
export const SITE_INDEXABLE = true;

/**
 * pageRobots — returns a Next `robots` metadata value.
 * Indexable only when the site is live AND this page clears its quality bar
 * (e.g. a figure with ≥3 published takes). Otherwise noindex (but follow, so the
 * link graph is still crawlable for when we go live).
 */
export function pageRobots(meetsBar = true): Metadata["robots"] {
  if (SITE_INDEXABLE && meetsBar) return undefined; // default = indexable
  return { index: false, follow: true };
}

/**
 * INDEX COHORTS — scaled-content-abuse guard (2026-07-02).
 * A brand-new domain (indexable since 2026-06-17, ~0 backlinks) advertising
 * 25k+ AI-written pages at once fits Google's scaled-content detection pattern.
 * So the sitemap releases the interpretive corpus in cohorts: oldest-first,
 * deterministic, capped by the constants below. Pages NOT in the cohort stay
 * indexable (no noindex) — they are simply not advertised yet.
 *
 * RAISE these numbers gradually (e.g. weekly ×1.5–2) while GSC shows the
 * indexed-page count and impressions keeping up. Order is stable (created_at
 * asc, then slug), so raising a cap only APPENDS URLs — never reshuffles.
 */
export const INDEX_COHORT_READINGS = 2000; // /take/* pages in sitemap
export const INDEX_COHORT_TROPES = 1500; // /trope/* pages in sitemap







