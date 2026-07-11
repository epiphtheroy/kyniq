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
 *  - 2026-07-04 (Atlas read layer, docs/PLAN-atlas-seo.md): the geo corpus
 *    (25k pins, ~100% with narrative prose) gets server pages — /film/x/
 *    locations ("where was X filmed", 1,707 eligible at ≥3 merged pins,
 *    cohort 1000 below), /director/x/locations (331 at ≥2 films & ≥6 pins)
 *    and /locations/[country] hubs (73 at ≥3 films & ≥3 pins; all advertised,
 *    no cohort — small set). New children: sitemaps/locations.xml (film
 *    cohort) + sitemaps/locations.xml (countries + directors). Gates mirror the
 *    pages' own 404/robots bars (lib/locations.ts). Raise the film cohort on the
 *    standard weekly GSC evidence rule.
 *  - 2026-07-04 (Atlas Phase 3, same evening, user-directed): city/region
 *    hubs /locations/{country}/{city} — 511 pages (439 city + 72 region) from
 *    the frozen lib/atlas_cities.json roster (worker/atlas-cities-build.py:
 *    locality terms from pin names, ≥3 visible films, p90 spread ≤150 km —
 *    ambiguous terms like "Washington" self-drop; variants like "New York
 *    City"/"New York" merge). New child sitemaps/cities.xml (no cohort —
 *    the artifact IS the release set, capped 1000). Pages re-check the
 *    ≥3-film bar via robots as drift protection.
 *  - 2026-07-05 (figure/trope/archetype on-page upgrade — no sitemap change):
 *    /trope/[slug] members now RANKED live via new RPC trope_members_ranked
 *    (cosine take↔trope embedding; figure_type_members.sim is constant per
 *    trope = cohesion, unusable) with % match badges, listicle titles
 *    ("… — N films that stage this trope, ranked"), ItemList + FAQPage
 *    JSON-LD, coherence stat. Figure pages: visible lead-question H2 (twin
 *    of FAQ), trope Type counts, NEW nearest-figures section (figure_neighbors
 *    RPC, cross-film only). /catalog nodes: double-brand title fix, count+
 *    ranked titles, rank №s + confidence %, kindred sim %, Byline/Provenance
 *    + CollectionPage dates/editor, FAQPage. /methodology#rankings explains
 *    every % — all numbers render-derived, nothing baked.
 *  - 2026-07-05 (Lineage read layer): the awards/canons corpus (398 lists,
 *    10,551 sourced memberships, 300 Wikidata QIDs) surfaces — /lineage/[slug]
 *    pages upgraded (search-phrase titles, double-brand fix, robots ≥3
 *    members, per-list source + QID sameAs, ItemList JSON-LD) and NEW
 *    /film/x/honors pages (≥3 lineage rows, 895 eligible INCLUDING Tier-2
 *    catalog films — honours are facts, not editorial, so they stand without
 *    the ≥3-figure bar). Children: sitemaps/lineage.xml (~202, no cohort) +
 *    sitemaps/honors.xml (cohort 500 below). Raise on the standard weekly
 *    GSC evidence rule.
 *  - 2026-07-06 (user decision): the honours record moved to
 *    /film/lineage/[slug]; the old /film/x/honors route 308s (whole-pattern
 *    permanentRedirect, no slug_aliases rows). Film pages: separate Honors
 *    tab removed — the Lineage tab/section itself now carries the honours
 *    presentation (per-row source tags via lnListMeta).
 *  - 2026-07-06 (user decision, mirror of the honours move): the per-film
 *    locations page moved to /film/locations/[slug]; old /film/x/locations 308s
 *    (whole-pattern permanentRedirect). Film pages: separate Locations tab
 *    removed — the Atlas section's pill button links out instead. Spec pack
 *    site_content/ (SEO_LINEAGE_SPEC etc.) applied the same day: bare-QID
 *    citation fix, Movie-node parity (@id/date/sameAs/award on film + record
 *    pages), Dataset on /lineage, "N of M matched" completeness notes
 *    (KNOWN_TRUE_SIZE, definitional sizes only), methodology Lineage section.
 *  - 2026-07-06 (film-page trope depth, follow-up to the 07-05 upgrade):
 *    each Tropes row on /film/[slug] now carries this film's own reading
 *    title (strongest published take via takes.trope_id) linking to the
 *    carrying figure — per-film unique text under every trope link.
 *    Canonical doc for the whole ranked-surfaces layer:
 *    HANDOFF-트로프피겨아키타입-순위표면.md.
 */
// Feeds Organization.sameAs in app/layout.tsx (owner fills in profile URLs as they go live).
export const SOCIAL_PROFILES: string[] = [
  "https://wonwooyoon.substack.com/",
  "https://letterboxd.com/wonwoo_metatake/",
  "https://x.com/wonwooyoonje",
];

export const INDEX_COHORT_READINGS = 2000; // /take/* pages in sitemap
export const INDEX_COHORT_MISREADINGS = 2000; // /film/*/misreadings articles in sitemap (added 2026-07-07)
export const INDEX_COHORT_FILM_CREDITS = 1000; // /film/*/credits pages in sitemap (added 2026-07-08)
export const INDEX_COHORT_TROPES = 1500; // /trope/* pages in sitemap
export const INDEX_COHORT_FIGURES = 2000; // /film/*/figure/* pages in sitemap (added 2026-07-03)
export const INDEX_COHORT_CREW = 1500; // /credits/* person pages in sitemap (added 2026-07-03)
// 2026-07-04 (surface expansion, docs/PLAN-seo-surface-expansion.md): sitemap
// split into per-section children; whereto (1,934) + genres (18) + theorists
// (358, ≥3 readings) + catalog Phase A opened the same day. Catalog Phase A =
// named-archetype nodes (object/place/character/theme) with ≥3 member figures
// (917 eligible); Phase B (tier taxonomies, ≥5 members, ~+590) waits on GSC
// evidence. Raise on the standard weekly evidence rule.
export const INDEX_COHORT_CATALOG = 500; // /catalog/{seg}/{slug} archetype nodes in sitemap (added 2026-07-04)
export const INDEX_COHORT_FILM_LOCATIONS = 1000; // /film/*/locations pages in sitemap (added 2026-07-04; 1,707 eligible)
export const INDEX_COHORT_FILM_HONORS = 500; // /film/*/honors pages in sitemap (added 2026-07-05; 895 eligible incl. Tier-2)
export const INDEX_COHORT_ESSAYS = 300; // /film/*/{desk} Engine Room essays cohort 1 (added 2026-07-07; ~1,650 eligible EN)
export const INDEX_COHORT_ESSAYS_KO = 300; // /film/*/{desk}/ko Korean essays cohort 1 (added 2026-07-08; ~1,613 eligible KO)







