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
