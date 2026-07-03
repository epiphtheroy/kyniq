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
 *
 * RELEASE LOG — treat each entry as one weekly step; do NOT raise again
 * before the "next review" date, and only if GSC indexed count + impressions
 * kept climbing since the previous step:
 *  - 2026-07-02: sitemap 4,163 → 6,841. Not a cap raise — fixed Supabase's
 *    1,000-row response cap silently truncating films (1,000→1,935),
 *    movies-like (→1,935), directors (→~860) and tropes (1,000→the intended
 *    1,500). All recovered pages are Tier-1 quality-gated (visible +
 *    is_analyzed; on-page noindex below the ≥3-figure / ≥3-recs bars).
 *    NEXT REVIEW: 2026-07-16 — until then, freeze both cohort caps.
 *  - 2026-07-02 (same day, separate content wave): +150 featured Q&A pages
 *    (/film/x/q/y) across 25 top-prestige films — corpus-grounded, generated
 *    then adversarially verified (83/233 candidates killed), all with QAPage
 *    JSON-LD. Pipeline: worker/qa-seed/. Published questions: 61 → 211.
 *    Next Q&A waves: ~25–50 films/week, same gate, watch GSC between waves.
 *  - 2026-07-02 (held-stock audit): the 89 legacy gemini 'held' Q&A were run
 *    through the same verifier — 71 published (metadata fixed), 18 rejected
 *    for fabrications/duplicates. Published questions: 211 → 282.
 *  - 2026-07-03: figure pages enter the sitemap for the first time
 *    (INDEX_COHORT_FIGURES=2000; only figures with ≥3 published takes on
 *    visible films — mirrors the on-page noindex bar). These are the
 *    entity-query surface ("the feather in Forrest Gump meaning"). Framework
 *    hub <title>s rewritten to search phrases the same day. Raise this cohort
 *    on the same evidence rule as the others.
 *  - 2026-07-03 (own-URL waves for buried editorial): (1) why-watch lenses →
 *    "Why should you watch X?" Curious pages, 300 top-prestige films —
 *    claude-haiku-4-5 realtime weaves the existing film_asset prose (no new
 *    facts allowed), worker/qa-seed/whywatch_gen.py. (2) The Life →
 *    /director/[slug]/life "Who is X?" pages (~208, ≥4-facts gate); director
 *    page keeps a 6-fact teaser. Next why-watch waves: ~300/week on the
 *    standard GSC evidence rule.
 *  - 2026-07-03 (crew read-layer): /credits/[person] server pages shipped —
 *    1,065 key-craft people (writer/dp/editor/composer/pd) with ≥3 catalog
 *    films (lib/crew_index.json, rebuilt by worker/crew-index-build.py).
 *    On-page noindex below the same ≥3 bar; native-script aliases surfaced
 *    for non-English names. Film pages gained a crawlable Credits block.
 */
// Feeds Organization.sameAs in app/layout.tsx (owner fills in profile URLs as they go live).
export const SOCIAL_PROFILES: string[] = [];

export const INDEX_COHORT_READINGS = 2000; // /take/* pages in sitemap
export const INDEX_COHORT_TROPES = 1500; // /trope/* pages in sitemap
export const INDEX_COHORT_FIGURES = 2000; // /film/*/figure/* pages in sitemap (added 2026-07-03)
export const INDEX_COHORT_CREW = 1500; // /credits/* person pages in sitemap (added 2026-07-03)







