# TASK B — FILM PAGE SURFACES (recon report)

## 0. Conventions found everywhere
- **DB client**: every page builds its own anon client `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`.
- **ISR house pattern**: `export const revalidate = N` + `generateStaticParams(){return []}` (nothing prebuilt, on-demand + Full Route Cache) + per-slug `unstable_cache` keyed loaders tagged `film:<slug>` (or `takescore-film:<slug>`).
- **Robots gate**: `pageRobots(meetsBar)` in `lib/seo.ts` — `SITE_INDEXABLE=true`; fail → `{index:false, follow:true}`. Sitemap release is separately capped by `INDEX_COHORT_*` constants in `lib/seo.ts` (⚠️ cohort freeze until 2026-07-16 per file comment).
- **Two tiers**: `films.is_analyzed=false` = Tier-2 catalog record (usually `visible=false`); Tier-1 = analyzed + `visible=true`. `films.visible` gates indexing/editorial; ambient-data surfaces (lineage, geo, reception) deliberately do NOT gate on it.
- ⚠️ **unstable_cache key-bump invariant**: Data Cache outlives deploys — any payload shape change requires a new cache key (history: `film-load7`, `film-chrome2`, `film-sentences-v2`, `desk-essay-6`, `film-misreadings-2`, `film-locations3`, `film-honors2`, `film-credits-page-2`, `tow-comment2`, `takescore-film-card1`).
- ⚠️ **Null-poison guard**: loaders that can transiently fail THROW inside `unstable_cache` so an error is never cached as empty (`loadSentences`, `cinecodex_card` loader, `loadTow`). `/takescore/film` additionally re-checks uncached before 404 (poisoned-null recovery).
- ⚠️ Stray file `app/film/[slug]/reception/page 2.tsx` (filename with space) — a duplicate of page.tsx sitting in the route dir; not a route, but importer/codemod tooling should not touch or ship it.

---

## 1. `/film/[slug]` — app/film/[slug]/page.tsx (1,663 lines; the hub)
**ISR**: `revalidate=300`; loaders `unstable_cache(["film-load7",slug])`, `["film-chrome2",slug]`, `["film-sentences-v2",slug]`, `["film-t2-related",slug]`, `["tow-comment2",slug]`, tv-probe `["film-tv-present-v2",slug]` — all `tags:["film:<slug>"]` (tow uses `takescore-film:<slug>`), so on-demand revalidation per film is possible via tag.

**Root fetch**: `films` select of `id,title,original_title,slug,year,director,director_slug,genres,poster_path,backdrop_path,tagline,runtime,release_date,certification,overview,imdb_id,tmdb_id,wikidata_id,tmdb_extra,created_at,visible,is_analyzed` by `slug`. Missing film → `resolveAlias("/film/"+slug)` (lib/aliases.ts, `slug_aliases` presumably) → 308, else `notFound()`.

### 1a. Branch A — Tier-2 minimal (`is_analyzed === false`)
Data: RPC `film_lineage_for(p_film_id)`, RPC `film_next_reverse(p_film_id)`, tables `film_ratings`, `film_watch_providers`, RPC `film_geo(p_slug)` (⚠️ SECURITY DEFINER, NOT visibility-gated — works for Tier-2; underlying `film_locations` has RLS with no anon policy), `film_scores` (track='all'; prestige/discovery), stamp probes `film_lineage.created_at` + `film_next.created_at`, head-counts on `film_wd_honors` + `film_reception` (gates the Afterlife tab so `/film/x/reception` link never 404s), `loadLineageListMeta` (`lineage_lists`), `relatedForTier2Film` (lib/related.ts — director/tradition/genre shelves; auteur lists excluded).
- **hasDigest** gate: `lineage>0 || ratings || recommendedBy>0 || geoCount>0 || watchRegions>0 || prestige!=null || discovery!=null`. Without it, About-first fallback layout; every digest sentence renders only when its source rows exist (LLM-0, deterministic; "Record updated" = max of source timestamps, never today).
- ⚠️ `digestQuote` cleanliness gate: `film_next.reason` rows can carry pipeline directives (`REPLACE|TODO|FIXME`) — never quote those.
- Tier-2 tab rail (`FilmTabBar`, ids): `df-digest`, `df-codex` (TakeScore, if `cinecodex_for` non-null), `df-lineage`, `df-recby`, `df-know` (Embedding Fantasia, gate sentences≥2), `df-atlas` (Locations, geoCount>0), `df-afterlife` (link `/film/x/reception`, gate honor/review counts>0), `df-crew`/`df-credits`, `df-watch` (always), `gallery` (link, needs poster).
- Metadata: title "…— Cast, Where to Watch & Context"; `robots: pageRobots(false)` → **Tier-2 base film page is always noindex,follow**.
- JSON-LD: Movie (@id `https://metatake.net/film/<slug>`, actors from `films.tmdb_extra.cast`), BreadcrumbList, WebPage (editor Wonwoo Yoon, dateModified=record date).

### 1b. Branch B — Tier-1 full load (`loadUncached`, ~20 round-trips)
Parallel wave: `figures` (status='approved'), `film_affinities` (top-5 by score), `media` (entity_type='film', status='published', position-ordered — stills/trailer/hero reel), RPC `film_catalog(p_film_id)` (archetype axes), `film_reception` direct select (dek_lead+review_year), RPC `film_next(p_film_id)` (Watch next 9), RPC `film_asset(p_film_id)` (Why-watch lenses, keys like `auteur_vision` mapped via `WW_TITLE`), RPC `film_next_reverse`, RPC `film_lineage_for`, `film_ratings`, `film_watch_providers`, `questions` (status='published'), RPC `film_counterpoints(p_slug,p_n:6)`, `essays` (lang='en', status='verified' → desk links via `lib/desks.ts` DESKS), `posts` (status='published', `entries` jsonb containment on `film_slug` → The Daily). Then: `takes` (`in figure_ids`, status='published' — misreadings + invitation + per-trope reading titles), `figure_type_members`→`meta_takes` (kind='figure_type', status='published' → Tropes), related-film art lookups (`films … eq visible,true` — hidden kin silently dropped), counterpoint posters, RPC `film_geo`, `now_articles`+`now_stream` head-counts (In the news), `film_release_events` + `film_wd_honors` counts (afterlife scale badges), `filmKeyCrew(tmdb_id)` (lib/filmCrew.ts, TMDB live fetch cached `["film-crew",tmdbId]` 24h), `filmCreditsData(slug)` (lib/film-credits-data.ts, `["film-credits-page-2",slug]` 86400 — MakerPanels), chrome RPCs `film_movements(p_slug)`, `cinecodex_for(p_slug)`, `cinecodex_film_subscores(p_slug)`, RPC `film_sentences_for(p_slug,p_limit:48,p_per_pattern:6)` (Embedding Fantasia), RPC `tow_comment(p_slug)` (to.W letter), `tv_programs` exists-probe (status='published', slug===film slug).
- ⚠️ `takeCount` returned as plain object — **Data Cache can't serialize Maps**.
- Hero precedence: TV broadcast (`FilmTVHero`, client-fetches `/api/tv/watch?v=slug`) → video reel `FilmHeroReel` (clips first, trailer last) → backdrop img → empty div.
- **Tier-1 tab rail (spoiler-zoned)** — free zone: `df-invitation` (invitation take exists), `df-whywatch` (film_asset rows), `df-codex` (TakeScore w/ score badge), `df-watch` (always), `df-lineage`, `df-atlas` (Locations badge=mergePins count), `df-network` (Connections, always — `ConnectionDesk` client-fetches `/api/map?type=film&key=slug`, full view `/network?m=critical&t=film&k=slug`), `df-know` (sentences≥2), `df-reception`, `df-in-the-news` (newsCount>0), `df-daily`, `df-recby`, `df-watchnext`, `df-connected` (Films like, recs>0), `df-crew`/`df-credits`, `df-gallery` (link); spoiler zone: `df-tv` (▶ TV Broadcast, link `/tv/<slug>`), `df-readings` (Strong Misreadings!), `df-figures`, `df-tropes`, `df-archetype`, `df-curious` (questions+deskEssays>0), `df-counterpoints`. All sections null out gracefully when empty; `df-watch` renders even with no provider rows (AccessSummary handles null).
- Locations section link gate: `geoCells = mergeCells(film_geo).length >= FILM_LOCATIONS_MIN (3)` → pill to `/film/locations/[slug]` (mirrors that page's 404 rule + sitemap SQL — ⚠️ must stay in sync or the pill 404s).
- Metadata: title "… — Analysis, Themes & Symbols"; description from invitation prose (`descriptionFromInvitation`) else templated with counts. **Index gate: `figures.length>=3 && visible!==false`** via `pageRobots`.
- JSON-LD: Movie (@id, sameAs wikidata/tmdb/imdb, `award` from lineage `result==='won'` non-auteur rows, **Review node only when `cinecodex_film_subscores.takescore >= 0`** — ⚠️ negative ratingValue trips Google "value out of range" (GSC 2026-07-11); ratingValue must equal the visible badge = round(v−r)); BreadcrumbList (Home›Films›director›film); WebPage provenance (author Metatake org, editor Wonwoo Yoon). ⚠️ **Movie node @id/field parity with `/film/lineage/[slug]` is an invariant** (contradictions suppress rich results; SEO_LINEAGE_SPEC §1b-2).
- Per-film generated text rendered here: `takes.rationale/take_title/leap` (misreadings), invitation take (`takes.is_invitation`), `figures.description`, `film_asset` lens points, `film_next.reason`, `film_reception.headline/dek_lead/verdict`, `film_sentences` rows, `curation`→`tow_comment` letter, `essays.title` (links only), `questions.title/display_title`.

### 1c. `/film/[slug]/opengraph-image.tsx`
Reads `films` + `figures`(approved) + `takes` count (published, non-invitation); renders 1200×630 card with figure/misreading counts; fallback brand card if film missing. Sub-route OG images also exist at `[desk]/`, `misreadings/`, `reception/`, `figure/[figureSlug]/`, `lineage/[slug]/`, `takescore/film/[slug]/`.

---

## 2. `/film/[slug]/[desk]` — Engine Room desk essays (+ `/ko` sibling)
- Desks (`lib/desks.ts` DESKS): `theories`(mode `fan_theories`), `decoder`(`concept_briefing`), `debates`(`meta_critique`), `contested`(`radical_critique`), `reception-story`(`reception_meta`), `parallel-lives`(`juxtaposition`), `field-test`(`the_lens`), `exegesis`(`exegesis`). Unknown desk key → 404.
- Data: `films` (**gate: `!film || !film.visible` → 404**), `essays` newest by `(film_id, mode, lang='en', status='verified')` — **no essay/body → 404**; sibling desk probe (`essays` mode/lang list, gives "More desks" + hasKo hreflang); `media` videos for ReadHero; link dictionary `loadFullLinkDict` cached `["desk-link-dict-6"]` 86400; TMDB stills via `filmBackdropPaths(tmdb_id)` (lib/read-media.ts, fetch revalidate 86400) injected via `pickStills`/`injectFigures` (deterministic per `film.slug:desk`).
- ISR: `revalidate=3600`; loader `["desk-essay-6",slug,deskKey,lang]` tags `film:<slug>`.
- Robots: `pageRobots(true)` — indexable whenever it renders (the gate is existence of a verified essay). Sitemap cohort `INDEX_COHORT_ESSAYS=300` / `_KO=300`.
- Text source: `essays.body_md` (LLM-written, verified pipeline; ⚠️ generation currently FROZEN — wave-4 drafts local, per memory `engine-room-curious-integration`).
- JSON-LD: Article (about → film @id) + BreadcrumbList. `/ko` page mirrors with `lang='ko'`, hreflang pair, `pageRobots(true)`.

## 3. `/film/[slug]/credits`
- Data: entirely from `filmCreditsData(slug)` (lib/film-credits-data.ts): `films` row, TMDB live credits (fetch revalidate 86400), `media` videos, `films` tmdb_id→slug backfill in 150-chunks; crafts `KEY_CRAFTS=[writer,dp,editor,composer,pd]`.
- Gate: load null → 404 (VERIFY exact null conditions inside lib — film missing or no tmdb_id). Robots: `pageRobots(visible !== false && crew.length >= 2)`.
- ISR `revalidate=86400`, loader key `["film-credits-page-2",slug]`.
- All prose deterministic (relation ordinal sentences, QuickAnswers ≤5 from docs/PLAN-intent-coverage.md §5.5). JSON-LD: WebPage + BreadcrumbList (no Movie node). Sitemap cohort `INDEX_COHORT_FILM_CREDITS=1000`.
- Degradation: no relations → per-craft "no shared history" lines; no cast/companies → sections omitted.

## 4. `/film/[slug]/figure/[figureSlug]`
- Data: `films`, `figures` (by film_id+slug — ⚠️ NOT status-filtered here), `takes` (published) + `theorists` join, `sm_concepts` (concept→slug), RPC `take_traditions(p_ids)`, `meta_takes` kind='reading' full list (**LEGACY/VERIFY** — reads the retired reading model for the contribute UI `FigureContribute`), `figure_type_members`→`meta_takes` kind='figure_type' (tropes), RPC `figure_neighbors(p_figure,p_k:12,p_min:0.5)` + resolve (visible films only), `figure_taxonomy`→`taxonomy_nodes` (catalog), sibling `figure_type_members` (connected figures, approved only), `relatedForFigure` (lib/related.ts).
- Gates: film or figure missing → 404; **`takes.length===0` → redirect to `/film/[slug]`** (no empty shells). Robots: `pageRobots(takes>=3 && film.visible!==false)`. Sitemap cohort `INDEX_COHORT_FIGURES=2000` (≥3 published takes on visible films).
- ISR: `revalidate=300`, **no unstable_cache** (relies on route-level revalidate only — heavier than the house pattern; importer load-testing note).
- Title = `ruleFigureQuestion` / `messyFigureTitle` (lib/figureSeo.ts) — ⚠️ entity-identity invariant: H1/JSON-LD headline stay the label; question only in `<title>`/H2/FAQ.
- JSON-LD: Article + BreadcrumbList + FAQPage (only when `figures.description` exists; Q2 mirrors the top connected trope).
- Hero: `EntityTVHero program={film.slug} reelSlugs=[film.slug]` (client `/api/tv/watch` / `/api/tv/reel`; renders nothing if neither exists — graceful).
- Generated text: `figures.description`, `takes.*`.

## 5. `/film/[slug]/gallery`
- Data: `films` (`["gallery-film",slug]` 86400) — needs `tmdb_id` else 404; live TMDB `/movie/{id}/images` (env `TMDB_READ_TOKEN`; bearer if len>40 else api_key). No images → friendly empty state (no 404). ISR 86400.
- **Always `robots:{index:false,follow:false}`, canonical → `/film/[slug]`** (thin image page).

## 6. `/film/[slug]/misreadings`
- Data: `films` (**gate `visible` → 404**), `figures` approved (none → 404), `takes` published (invitation = lede; **zero non-invitation readings → 404**), `media` videos, TMDB stills.
- ISR 3600, key `["film-misreadings-2",slug]`, tag `film:<slug>`. Robots: `pageRobots(readings>=5)`.
- Eligibility for sitemap/index hub = `misreadingsEligibleSlugs()` in **`lib/sitemap-data.ts`** (unstable_cache `["misreadings-eligible-1"]` 86400: distinct visible-film slugs with ≥1 published non-invitation take), consumed by `misreadingsEntries()` (cohort `INDEX_COHORT_MISREADINGS=2000`) and `/curious/misreadings` index. ⚠️ never advertise films outside this set (article 404s).
- JSON-LD: Article + BreadcrumbList. Text: 100% assembled from `takes` (LLM-0 assembly).

## 7. `/film/[slug]/q/[question-slug]`
- Data: `questions` (status='published', joins `films!inner`, `profiles`, `canonical_answers`), `media` (entity_type='question'), question count for the film, `relatedForQuestion` (lib/related.ts). Missing/unpublished → 404.
- ISR `revalidate=300`, **no unstable_cache**.
- Spoiler machinery: `spoiler_level==='major'` swaps dek for `questions.safe_hook`, body behind `SpoilerShield`.
- Metadata: canonical set; **no robots override** → indexable by default (VERIFY intended — no per-page quality bar here beyond publication status).
- JSON-LD: QAPage (about→Movie w/ sameAs imdb/wikidata, acceptedAnswer from `canonical_answers.body` first 500 chars, author = "Metatake Editorial" org when `source==='ai'`) + BreadcrumbList.
- Generated text: `canonical_answers.body` (LLM, adversarially verified pipeline worker/qa-seed/).

## 8. `/film/[slug]/reception` — "Afterlife"
- Data: `films` (NOT visible-gated — Tier-2 allowed), `film_reception` (kinds `criticism`/`academic`), `film_release_events`, `film_wd_honors`, RPC `film_lineage_for` (award/festival/section rows w/ edition_year), `media` videos.
- **Substance gate**: `!reception.length && !wdHonors.length && !lnAwards.length` → 404 (release dates alone never publish). Robots: `pageRobots(reviews+papers+wdHonors+lineage >= 3)`.
- ISR 3600, key `["film-afterlife-1",slug]`, tag `film:<slug>`. QuickAnswers §5.3 (⚠️ deliberately never emits aggregate-score questions — tier is internal). Copyright rule: headlines + publishers' own link-preview text only, all items link out.
- Legacy alias: `/film/[slug]/honors` → 308 `/film/lineage/[slug]`; `/film/[slug]/locations` → 308 `/film/locations/[slug]`; `/film/[slug]/watch` → 308 `/whereto/[slug]`.

## 9. `/film/lineage/[slug]`
- Data: `films` (any visibility — ⚠️ deliberately NOT gated on `visible`; honors are facts), RPC `film_lineage_for`, `loadLineageListMeta` (`lineage_lists`), `cachedLocationsEligibility` (RPC `atlas_eligibility_json`, `["locations-eligibility"]` 3600) for safe sibling links.
- **Gate: `lineage.length < FILM_HONORS_MIN (3)` → 404** (lib/lineage.ts). Robots `pageRobots(lineage>=3)`. ISR 86400, key `["film-honors2",slug]`, tag `film:<slug>`. Sitemap cohort `INDEX_COHORT_FILM_HONORS=500` (sitemaps/honors.xml; 895 eligible incl. Tier-2).
- JSON-LD: **Movie node sharing the base film page's @id — parity invariant**, ItemList of honors, QuickAnswers §5.2 (⚠️ trap guards: rows are film-level — never phrase as person wins; `edition_year` = award year ≠ film year).

## 10. `/film/locations/[slug]` (+ legacy `/film/atlas/[slug]` → 308)
- Data: `films` (**gate `visible===false` → 404** — ⚠️ because `film_geo` itself is not visibility-gated), `loadFilmGeo` = RPC `film_geo(p_slug)`, `cachedLocationsEligibility` (RPC `atlas_eligibility_json`), `media` videos.
- **Gate: `mergeCells(raw).length < FILM_LOCATIONS_MIN (3)` → 404** — ⚠️ MUST mirror the sitemap SQL count (comment says it does) so advertised URLs never 404. Display uses `mergePins` (name-fusion ~2 km). ISR 86400, key `["film-locations3",slug]`.
- Robots: `pageRobots(true)` (gate already enforced by 404). Sitemap cohort `INDEX_COHORT_FILM_LOCATIONS=1000`.
- City phrasing derived ONLY from frozen roster `lib/atlas_cities.json` via `citiesForCountry`/`cityMemberPins` (⚠️ city membership rules must stay in sync with the RPC SQL, per memory).
- JSON-LD: ItemList of Place nodes (GeoCoordinates), Movie, BreadcrumbList, WebPage.

## 11. `/film` index — app/film/page.tsx
- Default view: RPC `films_catalogue_v2` (single jsonb `{total, items}` — ⚠️ v1 TABLE version was truncated at PostgREST 1000-row cap; never regress) + whole-inventory count (`films`, excluding `slug like 'tmdb-%'` stubs — ⚠️ stub-slug exclusion rule). Renders `FilmsIndex` (IndexExplorer: hero search + A–Z + live iframe spotlight seeded from `rich` items).
- `?view=all&page=N`: direct `films` read, NOT visible-gated (Tier-2 rows shown with "catalog" chip), 120/page, self-canonical per page, never noindex.
- `revalidate=1800`, no unstable_cache. JSON-LD: CollectionPage + BreadcrumbList + ItemList (numberOfItems = DB-real total, first 100 A–Z).
- **Importer note**: a new film appears here automatically once its `films` row exists (view=all) / once visible+`films_catalogue_v2` includes it (featured view — VERIFY that RPC's own gates).

## 12. `/movies-like/[slug]`
- Data: `films` (no visible gate on the subject itself), `film_affinities` top-24, related `films` (`visible=true` only — hidden kin dropped), `meta_takes` (figure_type, published) for reasons, RPC `takescore_for_slugs(p_slugs)` (bulk TS; ⚠️ this — not per-slug `cinecodex_card` loops — is the TS bulk standard).
- Gates: film missing → 404 (no alias fallback here — VERIFY); zero recs → renders with "No similar films yet" note; **robots `pageRobots(visible && recs>=3)`**; QuickAnswers only at recs≥3.
- ISR `revalidate=300`, **no unstable_cache** (per-request Supabase within route cache window). JSON-LD: ItemList(Descending) + WebPage w/ dateModified = max `film_affinities.updated_at`.
- Depends on connection-engine output: **empty `film_affinities` = thin page + noindex** — importer must run affinity build.

## 13. `/takescore/film/[slug]`
- Data: single RPC `cinecodex_card(p_slug)` (v2 jsonb: v/c/r/u/s, rank/rank_total, subs, comps, reliability, conf/tier, ext imdb/rt/meta, standing, 20-row basket) + `loadTow(slug)` (RPC `tow_comment`).
- Gate: RPC null/empty (unscored film) → 404. ISR 300, key `["takescore-film-card1",slug]`, tag `takescore-film:<slug>`; ⚠️ error-throw + uncached double-check anti-poison pattern.
- Prose 100% rule-based (`lib/takescore_prose.ts`); ⚠️ the underlying score is LLM (sonnet)-graded = paid — importer must run the scoring batch for new films or page 404s. Unscored Tier-2 274 films remain unpublished by design.
- JSON-LD: Review (itemReviewed Movie, ratingValue=round(u), 0–100, author Person Wonwoo Yoon) **only when ts fits scale (no negative)** + BreadcrumbList. Own branded `opengraph-image.tsx` (deliberately no `og:images` in metadata).

## 14. `/tv/[slug]`
- Data: RPC `tv_watch(p_list:null,p_program:slug)` (entry+segments) + `tv_programs` (status='published', built_at/duration_ms/seg_count); rail via `tv_watch(p_list:null,p_program:null)`. React `cache()` dedupe only; ISR 300, `maxDuration=30`.
- Gate: no published program → 404 (metadata fallback returns `robots:{index:false,follow:true}`).
- ⚠️ invariants (memory): `tv_*` tables have RLS with 0 policies (migration 0059) — access ONLY via RPC; `tv_watch`/`tv_reel` carry function-level `set statement_timeout` (anon default 3s would kill them); use `built_at` not `created_at`; compiled LLM-free by `tv_compile_film`.
- JSON-LD: VideoObject (+`hasPart` Clip chapters for key moments, uploadDate from `built_at` via `safeIso` — ⚠️ guard against malformed timestamptz 500s) + BreadcrumbList; `og:video`/video.other OG.

## 15. `/whereto/[slug]`, `/where-to-watch`, `/watch`
- `/whereto/[slug]`: `films`, `film_watch_providers`, `film_ratings`, RPC `cinecodex_for`, `figures` (approved, 6), `media` videos + build-time `lib/access_enrichment.json` (keyed by tmdb_id; regenerated by `worker/access-enrich-build.py` — ⚠️ bundled at build, new films need a rebuild+deploy to get verified-access data; provider matrix still works without). Gates: film missing → `resolveAlias` 308 else 404; **robots `pageRobots(visible !== false)`**; renders fine with zero provider rows (report degrades to generic sentences). ISR 300, no unstable_cache. JSON-LD: BreadcrumbList + Movie (@id → `/film/[slug]` — canonical entity home). ⚠️ `verdict_note` may be internal Korean memo — only surfaced when <10% non-ASCII.
- `/where-to-watch`: landing; `access_enrichment.json` ids joined against `films` by `tmdb_id`; typeahead routes to `/whereto/{slug}`. revalidate 300.
- `/watch`: pure 308 → `/tv` (LEGACY).

---

## 16. Cross-cutting data dependencies (importer checklist per new film)
Tables/RPCs a fully-populated film page consumes: `films` (incl. `tmdb_extra`, `wikidata_id`, `director_slug` — ⚠️ `lib/slug.ts` is the ONLY slug generator), `figures`, `takes` (incl. invitation + `trope_id`), `media` (stills/videos), `film_affinities`, `figure_type_members`+`meta_takes(kind='figure_type')`, `figure_taxonomy`+`taxonomy_nodes` (via RPC `film_catalog`), `film_reception`, `film_release_events`, `film_wd_honors`, `film_lineage`+`lineage_lists` (RPC `film_lineage_for`), `film_next` (+reverse), `film_asset`, `film_ratings`, `film_watch_providers`, `film_scores`, `film_sentences` (RPC `film_sentences_for`), `questions`+`canonical_answers`, `essays`, `posts.entries`, `now_articles`/`now_stream`, `film_locations`→RPC `film_geo` + `atlas_eligibility_json`, cinecodex scoring (`cinecodex_card`/`cinecodex_for`/`cinecodex_film_subscores`/`takescore_for_slugs`), `curation` schema → RPC `tow_comment`, `tv_programs`(+segments via `tv_watch`), `slug_aliases` (resolveAlias), entity_edges (RPC `film_counterpoints`), `figure_neighbors` embeddings, `profiles` (Q&A byline). Build-time JSON: `lib/access_enrichment.json`, `lib/atlas_cities.json`, `lib/crew_index.json`.
Every module degrades to hidden when its rows are absent — the only hard 404s are: sub-pages below their gates ([desk] no verified essay; misreadings 0 readings or hidden film; reception no substance; lineage <3 rows; locations <3 cells or hidden film; gallery no tmdb_id; takescore unscored; tv unpublished; q unpublished). The only redirect-on-empty is figure pages with 0 takes.
Noindex-but-rendering states: Tier-2 base page (always), Tier-1 base page <3 figures, movies-like <3 recs, credits <2 crew, misreadings <5 readings, reception <3 items, figure <3 takes, whereto on hidden film, gallery (always).
⚠️ Post-import cache: all film-page loaders are tagged `film:<slug>` (takescore `takescore-film:<slug>`) — revalidateTag is the clean refresh path; otherwise 300 s–86400 s staleness windows apply, and ⚠️ live-HTML audits right after import will mis-report due to ISR cache (memory: `live-audit-isr-cache-trap`, use cache-busters).