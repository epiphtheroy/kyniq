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
 * FilmIndexSignals / filmIndexBar — the SEO consolidation gate (2026-07-14,
 * HANDOFF-SEO-스타터가이드-작업지시서.md §2). Single source of truth shared by the
 * film main page, all its subpages, and the sitemap (through lib/filmGate.ts).
 * Raw signal counts come from the film_index_signals_json() RPC (migration 0097).
 *
 * Verified on prod 2026-07-14: 1,105 Tier-2 films pass; Tier-1 visible = 1,959.
 *
 * ⚠️ `hold` is NOT an input. It is the factory's "ingested-as-stub, not yet
 * promoted" flag, set on 4,723/4,997 Tier-2 films (the whole cohort) — excluding
 * it would collapse the gate to 21 films. Deliberate junk = tmdb-% stubs. The 22
 * editorially-hidden films are is_analyzed=true and never enter the Tier-2 path.
 */
export type FilmIndexSignals = {
  slug: string;
  is_analyzed: boolean;
  visible: boolean;
  n_reception: number;
  n_lineage: number;
  n_wd_honors: number;
  n_providers: number;
  n_affinities?: number; // movies-like sitemap gate
  created_at?: string; // sitemap Tier-2 cohort ordering (oldest-first)
};

export function filmIndexBar(s: FilmIndexSignals): boolean {
  if (!SITE_INDEXABLE) return false;
  if (s.slug.startsWith("tmdb-")) return false; // unresolved-stub guard
  // Tier-1: existing bar — visible ⇔ ≥3 approved figures (DB trigger).
  if (s.is_analyzed) return s.visible;
  // Tier-2: a strong editorial signal (any). Availability is NOT required (owner call 2026-07-15):
  // a film with real scholarship / awards / canon-standing is substantive whether or not it streams
  // anywhere, and the page states "No streaming" honestly rather than hiding. This aligns with the
  // site's own stance (poetics/availability-is-destiny: "availability would not move a number").
  // Effect: +62 provider-less-but-strong films index immediately; more as reception fills.
  const strong = s.n_reception >= 3 || s.n_lineage >= 3 || s.n_wd_honors >= 3;
  return strong;
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
 *    ("… — N films that stage this trope, ranked"), ItemList
 *    JSON-LD, coherence stat. Figure pages: visible lead-question H2, trope
 *    Type counts, NEW nearest-figures section (figure_neighbors
 *    RPC, cross-film only). /catalog nodes: double-brand title fix, count+
 *    ranked titles, rank №s + confidence %, kindred sim %, Byline/Provenance
 *    + CollectionPage dates/editor. (FAQPage/QAPage JSON-LD retired 2026-07-14
 *    — FAQ rich results are gov/health-only since 2023-08.) /methodology#rankings explains
 *    every % — all numbers render-derived, nothing baked.
 *  - 2026-07-05 (Lineage read layer): the awards/canons corpus (398 lists,
 *    10,551 sourced memberships, 300 Wikidata QIDs) surfaces — /lineage/[slug]
 *    pages upgraded (search-phrase titles, double-brand fix, robots ≥3
 *    members, per-list source + QID sameAs, ItemList JSON-LD) and NEW
 *    /film/x/honors pages (≥3 lineage rows, 895 eligible INCLUDING Tier-2
 *    catalog films — honours are facts, not editorial, so they stand without
 *    the ≥3-figure bar). [⚠️ SUPERSEDED 2026-07-14: this "no gate" stance was a
 *    scaled-content leak; /film/lineage now gates on filmMainIndexable — see the
 *    07-14 entry below.] Children: sitemaps/lineage.xml (~202, no cohort) +
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
 *  - 2026-07-14 (SEO consolidation gate — canonical: HANDOFF-SEO-스타터가이드-작업지시서.md §2):
 *    a full Search-Essentials audit closed a scaled-content LEAK (takescore/
 *    reception/lineage subpages indexed ~6,800 pages for Tier-2 films the thin
 *    gate hid) by CONSOLIDATING: filmIndexBar (above) promotes 1,105 Tier-2
 *    catalog films (reception≥3 OR lineage≥3 OR wd_honors≥3, AND provider≥1,
 *    NOT tmdb-%) from noindex → indexable. Indexable mains 1,959 → ~3,064. New
 *    FILMS_T2 cohort at 300 (below), released oldest-first. Every film SUBPAGE
 *    now gates robots on filmMainIndexable && ownBar; the sitemap functions
 *    (filmEntries/sitemapTakescoreFilms/filmReceptionEntries/honorsEntries/
 *    moviesLikeEntries) mirror the gate through the film_index_signals_json
 *    roster (migration 0097). ⚠️ This REVERSED the 2026-07-05 "honours are
 *    facts, stand without a gate" decision above: /film/lineage now gates on
 *    filmMainIndexable && lineage≥3, honorsEntries filters through the roster.
 *    Same ship: displayTs() 0-clamp on negative TakeScores (display+schema only;
 *    ranking/API raw), Review author Person→Organization, flagged/n=1 copy
 *    removed, FAQPage→(removed)/QAPage→Article. `visible` is now decoupled from
 *    indexability (it is only the figures≥3 thinness trigger).
 *  - 2026-07-15 (Tier-2 main consolidation — canonical: HANDOFF-Tier2-메인통합.md;
 *    commit 5e8f507): promoted film mains + thin director hubs now RENDER their
 *    existing content (wd_honors/release/scholarship digests, StillHero parity /
 *    catalog TakeScores, press/honors/availability/locations digests) instead of
 *    head-counting it, so they escape thin-content. NEW director-hub robots gate
 *    lib/directorGate.ts directorIndexBar (858 → 678 indexed / 180 noindex),
 *    mirrored by directorEntries. No new INDEX_COHORT (director gate is robots-
 *    based; all 678 passers advertised).
 *  - 2026-08-31 (channel correction — the cohorts were Google tax, and Google left):
 *    measured over 30 days, Google referred 15 visitors and the Bing family
 *    (DuckDuckGo 392, Bing 323, Yahoo/Ecosia/Startpage ~120) referred ~840 — and
 *    the weekly series is monotonic: Bing family 2 → 269 since 07-06 while Google
 *    went 15 → 1. GSC over the same window: impressions moved 15 → 60/day but
 *    average position collapsed 11 → 65, and every July winner
 *    (/film/locations, /movies-like, /director/[slug]/locations) left the report.
 *    A `noindex` is not a Google-only directive — Bing, DDG, Yahoo and Ecosia all
 *    honour it, and the AI answer engines lean on Bing's index — so cohorts sized
 *    for Google's scaled-content detector were suppressing the only channel that
 *    still pays. Three raises, all on routes the referrer log shows earning:
 *      · TROPES 1,500 → 4,710 (every published figure_type; pages already
 *        indexable, they were simply unadvertised — zero new page surface).
 *      · FILM_LOCATIONS 1,000 → 3,400 and the Tier-2 404 gate lifted (below).
 *      · WHERETO: new cohort — Tier-2 watch pages leave noindex at ≥3 countries.
 *    NOT raised, deliberately: /tv/[slug] stays noindex (it re-cuts the SAME readings
 *    as /film/meaning/[slug], so opening it starts an internal canonical fight
 *    rather than a thinness question), and /movies-like stays Tier-1 (film_affinities has zero
 *    rows for the catalogue — there is nothing to render).
 *    WATCH: this adds ~9k sitemap URLs while a headless fleet is already copying
 *    the corpus (crawler-fleet-surge-2026-08-31) — every raise here is one
 *    constant, so dial back if Vercel ISR writes or function hours move.
 */
// Feeds Organization.sameAs in app/layout.tsx (owner fills in profile URLs as they go live).
export const SOCIAL_PROFILES: string[] = [
  "https://wonwooyoon.substack.com/",
  "https://letterboxd.com/wonwoo_metatake/",
  "https://x.com/wonwooyoonje",
];

/**
 * Entity-identity resolvers (HANDOFF-AI봇맞이하기.md §0.4 — the ③ trust gate).
 * Answer engines verify ENTITIES, not phrases: until "Metatake" / metatake.net /
 * net.metatake/mcp / "Wonwoo Yoon" resolve to one Wikidata item each, credit for
 * a cited reading scatters across name variants. Set these to the Wikidata URIs
 * ONCE the owner creates the items (accounts + notability are the owner's job —
 * do NOT ship a fabricated Q-ID; a wrong sameAs is worse than none). When set,
 * they flow into Organization.sameAs (app/layout.tsx) and the founder Person node.
 */
export const WIKIDATA_ORG_URI: string | null = null; // e.g. "https://www.wikidata.org/wiki/Q…"
export const WIKIDATA_PERSON_URI: string | null = null; // Wonwoo Yoon's item, once notable
// ⚠️ A first self-authored item (Q140434620) was DELETED at Wikidata RFD 2026-07-12
// for failing WD:N (self-published sources don't count). Do NOT point sameAs at a
// deleted item — recreate WITH independent third-party references (§2.7) first.

/**
 * ORCID iD for the editor — a notability-free scholarly identifier that Wikidata
 * deletion cannot touch. A legitimate, durable sameAs for the Person node that
 * starts closing the ③ entity-identity gap without waiting on Wikidata.
 */
export const WONWOO_ORCID = "https://orcid.org/0009-0006-4641-5262";

/** Organization.sameAs = social profiles + any resolved Wikidata item. */
export const ORG_SAME_AS: string[] = [
  ...SOCIAL_PROFILES,
  ...(WIKIDATA_ORG_URI ? [WIKIDATA_ORG_URI] : []),
];

/** Person.sameAs for the editor — ORCID now, Wikidata person URI once notable. */
export const PERSON_SAME_AS: string[] = [
  WONWOO_ORCID,
  ...(WIKIDATA_PERSON_URI ? [WIKIDATA_PERSON_URI] : []),
];

/**
 * knowsAbout — the org's subject-matter expertise, an E-E-A-T signal that helps
 * an answer engine decide "why this source" for a film-criticism query. Shared
 * by the Organization node and the /partners proposal graph so they never drift.
 */
export const KNOWS_ABOUT: string[] = [
  "Film criticism",
  "Film theory",
  "Film studies",
  "Cinema",
  "Film analysis",
  "Filming locations",
];

export const INDEX_COHORT_READINGS = 2000; // /take/* pages in sitemap
export const INDEX_COHORT_MISREADINGS = 2000; // /film/*/misreadings articles in sitemap (added 2026-07-07)
export const INDEX_COHORT_FILM_CREDITS = 1000; // /film/*/credits pages in sitemap (added 2026-07-08)
export const INDEX_COHORT_TROPES = 4710; // /trope/* pages in sitemap (raised 2026-08-31: all published figure_type meta_takes)
export const INDEX_COHORT_FIGURES = 2000; // /film/*/figure/* pages in sitemap (added 2026-07-03)
export const INDEX_COHORT_CREW = 1500; // /credits/* person pages in sitemap (added 2026-07-03)
// 2026-07-04 (surface expansion, docs/PLAN-seo-surface-expansion.md): sitemap
// split into per-section children; whereto (1,934) + genres (18) + theorists
// (358, ≥3 readings) + catalog Phase A opened the same day. Catalog Phase A =
// named-archetype nodes (object/place/character/theme) with ≥3 member figures
// (917 eligible); Phase B (tier taxonomies, ≥5 members, ~+590) waits on GSC
// evidence. Raise on the standard weekly evidence rule.
export const INDEX_COHORT_CATALOG = 500; // /catalog/{seg}/{slug} archetype nodes in sitemap (added 2026-07-04)
export const INDEX_COHORT_FILM_LOCATIONS = 3400; // /film/*/locations pages in sitemap (added 2026-07-04; raised 2026-08-31 to cover Tier-2: measured roster 3,312 = 1,709 visible + 1,603 catalogue, at ≥3 cells)
export const INDEX_COHORT_FILM_HONORS = 500; // /film/*/honors pages in sitemap (added 2026-07-05; 895 eligible incl. Tier-2)
export const INDEX_COHORT_ESSAYS = 300; // /film/*/{desk} Engine Room essays cohort 1 (added 2026-07-07; ~1,650 eligible EN)
export const INDEX_COHORT_ESSAYS_KO = 1610; // /film/*/{desk}/ko Korean essays (added 2026-07-08; raised 2026-08-31 to the full verified set — bodies are fully Korean long-form)
export const INDEX_COHORT_FILMS_T2 = 300; // consolidated Tier-2 film mains in sitemap (added 2026-07-14; 1,105 eligible via filmIndexBar). Raise on the standard weekly GSC-evidence rule.
export const INDEX_COHORT_FILMS_KO = 300; // /ko/film/* Tier-1 mains (added 2026-07-16). HELD at 300 — see INDEX_COHORT_FILMS_KO_T2 for why.

/**
 * /ko/film/* catalogue (Tier-2) cohort — added 2026-08-31.
 *
 * §6.5 always intended the Korean cohort to be "Tier-2 digest-first, least
 * mixed-language" and filmsKoEntries even sorts that way, but the query filtered
 * `.eq("visible", true)`, so no Tier-2 row could ever reach the sort. The
 * ordering has been dead code since 2026-07-16. This opens it.
 *
 * MEASURED 2026-08-31, Hangul share of on-page text:
 *   Tier-2 /ko  20.3% · 19.7% · 24.1%   (latin is almost entirely nav chrome)
 *   Tier-1 /ko  13.9% · 14.5% · 17.4%
 * The gap is structural, not incidental. A Tier-2 page is a digest — its prose is
 * the invitation, which IS translated (content_i18n holds 6,960 Korean
 * invitations, verified fluent on jaws-1975 and house-of-sand-and-fog-2003). A
 * Tier-1 page adds three lanes that were never registered for translation: the
 * eight why-watch lenses, the readings, and Strong Misreadings. Those dominate
 * the page, which is why raising the Tier-1 cohort would advertise ~1,600 mostly
 * English pages at Korean URLs — the mixed-language canonical-folding risk §6.5
 * named. So Tier-1 stays at 300 until those lanes are translated.
 *
 * ⚠️ Known defect on BOTH tiers, tracked, not fixed here: filmLead() (lib/lead.ts)
 * emits its BLUF sentence in English ("Metatake rates House of Sand and Fog
 * (2003), directed by …") because its verdict clause comes from the rule-based
 * English band vocabulary in lib/takescore_prose. Localising it means localising
 * that vocabulary AND deciding what byte-identical-across-surfaces means per
 * locale (the pack / MCP / REST digest all reuse the string), so it is its own
 * piece of work, not a rider on a cohort raise.
 *
 * Separate slice rather than a shared cap: growth in the Tier-2 roster must never
 * silently de-advertise Tier-1 URLs the way one shared cap would.
 */
export const INDEX_COHORT_FILMS_KO_T2 = 1200; // 951 eligible at time of writing

/**
 * WHERE-TO-WATCH bar (2026-08-31). /whereto/[slug] used to inherit the film main's
 * indexability wholesale, so a catalogue film's watch page was noindex even when it
 * carried a full multi-country availability map — the exact page shape the referrer
 * log shows Bing and DuckDuckGo sending people to ("where to watch X").
 *
 * The page's own substance is the map: how many countries we hold an answer for.
 * At ≥3 the page states something no aggregator page states as precisely, and the
 * measured Tier-2 population is 3,221 films.
 *
 * ⚠️ INVARIANT: whereToEntries() in lib/sitemap-data.ts mirrors this predicate, so
 * an advertised /whereto URL can never carry noindex. The sitemap reads
 * film_watch_providers.countries; the page falls back to Object.keys(results) when
 * that column is null, so the sitemap can only ever under-advertise — the safe
 * direction. Change one, change the other.
 */
export const WHERETO_MIN_COUNTRIES = 3;
export function whereToIndexBar(nCountries: number): boolean {
  return SITE_INDEXABLE && nCountries >= WHERETO_MIN_COUNTRIES;
}
export const INDEX_COHORT_WHERETO = 5200; // /whereto/* Tier-2 entries (added 2026-08-31; 3,221 eligible)







