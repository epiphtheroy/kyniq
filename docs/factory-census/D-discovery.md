# TASK D — DISCOVERY & GLOBAL SURFACES: film-data dependency map

Repo: `/Users/jerryje/Documents/MetaTake`. Canonical pipeline doc already exists: **`docs/RUNBOOK-new-film-ingestion.md`** (18 stages, per-film vs corpus-wide split, §3b discovery matrix, §7 verification checklist) — the importer factory should be designed as an implementation of its §6 plan. All findings below verified in code.

---

## 1. Home `/` (`app/page.tsx` + `components/home2/HomeV2.tsx`)

**RPCs (all anon client, `unstable_cache`, tag `home-v2`):**
- `home_v2_bundle_v3(p_seed text)` — seed = UTC `YYYYMMDDHH`; statement_timeout **8s** (migration `0074_home_v3_timeout_guard.sql`). Defined in `0071_home_v8_rotation.sql`. Reads: `films` (gates: `visible`, `is_analyzed`, `poster_path`/`backdrop_path is not null` per section), `film_scores`, `film_ratings`, `cinecodex.scores` (TS chip: `v_value`/`r_risk` not null; left join → unscored Tier-2 just shows no chip), `figures (status='approved')`, `takes (status='published')`, `figure_type_members`, `meta_takes (status='published', kind='figure_type')`, `sm_concepts`+`concept_map`, `film_next` (Newly/watch-next pool), `director_facts` (directors block gated `intro is not null`), `directors`, `director_picks`, `lineage_lists` (stats).
- `home_daily_exhibits(p_seed)` (`0072_home_daily_exhibits.sql`, timeout 6s) — tiles from `cinecodex.scores`, `film_reception (review_year)`, `questions (status='published', spoiler_level<>'major')`, `film_locations`, `takes/figures` (misreading), `meta_takes` trope pair (`tc.films>=2`). Null → band self-omits.
- `home_readings_desk(p_seed)` (`0075_home_readings_desk.sql`) — `takes` published non-invitation × `figures approved` × `films visible + poster_path`, TS via `cinecodex.scores`. Null → section self-omits.
- `cinecodex_ranked(p_sort:'u',…)` — Screener promo strip (`getScreenerTop`).
- **SentenceTicker** (`components/SentenceTicker.tsx`) → `/api/sentences/ticker` → RPC `sentences_ticker(p_n)` → `film_sentences` (Stage 18, LLM-0, `ON CONFLICT DO NOTHING`).
- **HomeTVCredits** (`components/home2/HomeTVCredits.tsx`) — lazy-mounts `components/MetatakeTV.tsx` which fetches `/api/surprise/home` (RPC `surprise_home`); credits tile links `/credits` (static `lib/crew_index.json`).
- **HomeNetwork** → `/api/map` (CDN-cached, s-maxage=600); **HomeLocations** → `/api/geo`.

**New film inclusion:** automatic and rotation-based once `films.visible` + poster/backdrop + figures/takes/tropes exist; TS chip needs `cinecodex.scores` row; Newly section requires `is_analyzed=true AND backdrop_path`. Freshness: ISR `revalidate=3600` + nightly `/api/revalidate` path `/` tag `home-v2`.
⚠️ Invariants: **cache keys must NOT contain the hour seed** (stampede, 2026-07-11 incident); `fetchBundle` throws on empty so transient failures don't poison the Data Cache; ≤2 RPC attempts.

## 2. `/network` (`app/network/page.tsx` → `components/NetworkExplorer.tsx`)

- Client fetches `/api/map` (`app/api/map/route.ts`): RPCs `map_film_ego`/`map_film_overview`/`map_director_ego`/`map_director_overview`/`map_ego`/`map_overview`; route enriches nodes with `films.poster_path/year` and `directors.profile_path/birthday`.
- Film-ego edges (`0063_map_kin_weights.sql`): `film_next` (next/recby), `film_affinities`+`film_kinship.kin` (like edges, kin 0–100 → stroke width in `EntityGraph.tsx`), `entity_edges (kind='counterpoint')`. All legs filter `films.visible`.
- **Galaxy mode**: `/api/map/galaxy` → RPCs `galaxy_json` / `galaxy_directors_json` over `film_map_xy` / `director_map_xy`, built OFFLINE by `worker/galaxy-build.py` (t-SNE over `film_taste_vector` k=14 / `director_embedding` k=10; labels via RPCs `galaxy_refresh_cluster_labels`/`galaxy_refresh_director_labels`, source `supabase/rpc/galaxy.sql`).
- Search box → `/api/search?...&kinds=film,director,trope,idea,theorist,figure`.

**New film:** ego map automatic once `film_next`/`film_affinities`/`film_kinship` exist (Stages 12, 6, 18). Missing data → node renders with few/no edges (graceful). **Galaxy: NOT automatic** — new film absent from `film_map_xy` until `galaxy-build.py` reruns. ⚠️ RUNBOOK §4.e: galaxy rebuild moves ALL coordinates (whole new layout) — run ~quarterly, not per ingest. ⚠️ `/api/map`, `mapApi`/`mapFull` payload keys are deliberately kept names (rename charter).

## 3. `/locations` (`app/locations/page.tsx`, `app/locations/[slug]`, `lib/locations.ts`)

- Play layer: `FilmMap` → `/api/geo` (`app/api/geo/route.ts`): RPCs `film_geo`, `director_geo`, `country_geo`, `geo_bbox_json`, `geo_overview_sample_json`, `geo_overview_json(p_limit 30000)` (jsonb_agg single-row to beat PostgREST 1000-row cap), fallback `geo_overview`.
- Read layer: `cachedLocationsEligibility()` → RPC `atlas_eligibility_json` (country grid **GATE: ≥3 located films per country**); `cachedLocationsMeta()` → `atlas_meta_json` (Dataset JSON-LD counts); country page → `atlas_country_json(p_slug)`; city/region hubs → frozen roster `lib/atlas_cities.json` (rebuilt by `worker/atlas-cities-build.py`) + `atlas_city_candidates_json`.
- Underlying table: `film_locations` (+ `geo_cache`), written by `worker/geo-extract.py` (LLM, `GEO_FILMS=<slug>` scoping) → `worker/geo-code.py --apply` (Google Geocoding `GOOGLE_MAPS_KEY` or Nominatim). Stage 17, per-film additive.

**New film:** automatic on the world map + country hubs once `film_locations` rows have `lat/lng`; no pins → film simply absent (graceful; film-page Locations tab hides). ⚠️ Eligibility counting MUST use `mergeCells` (== SQL `atlas_eligibility_json`), never `mergePins` — name-fusion can drop a film below the bar and desync sitemap vs page (`lib/locations.ts` comment). ⚠️ `atlas_*` RPC/file names are deliberately kept post-rename. New cities need `atlas_cities.json` rebuild + roster is frozen otherwise.

## 4. `/search` + `lib/search.ts` + `/api/search`

- **Lexical**: RPC `search_all(p_q, p_limit)` — current version `0062_search_v7_tv_legs.sql`. Legs/kinds: `film` (films.title/original_title/director **+ `search_aliases`**), `director` (directors, gated `exists(films where director_slug=d.slug)` — a director with 0 films never surfaces, + aliases), `trope` (`meta_takes` published figure_type), `reading` (`takes` published), `figure` (`figures` join `films`), `theorist` (`theorists`), `idea/concept` (`sm_concepts`), `theory` (`theory_canon`), `lineage` (`lineage_lists`), hub (`curation.hub`), `archetype` (`taxonomy_nodes`), `now` (`now_articles`), `tv` (`tv_programs` join films, weight 0.84), `tv_list` (`tv_playlists`, 0.82). Kind weights: film/director 1.00 … reading 0.78.
- **Essays leg**: RPC `search_essays` (`0054_search_essays_by_entity.sql`).
- **Semantic**: OpenAI `text-embedding-3-small` query vector → RPC `search_semantic(p_qvec, p_limit)` (`0040_search_v3.sql`): legs over `takes.embedding`, `meta_takes.embedding`, `film_taste_vector` join films (Tier-2 marked `is_catalog = not visible`), `director_embedding`, `theory_canon.embedding`, `taxonomy_nodes.embedding`, + essays (`0056_essays_embedding_semantic_leg.sql`). ⚠️ semantic floors 0.35/0.27; floor gated on `search_all` rows only.
- **`search_aliases`** (`0053_search_v4_ranking_aliases.sql`): `kind in ('film','director','theorist')`, unique `(kind,slug,alias)`, Korean-first. **A NEW film does NOT get alias rows automatically** — requires `films.wikidata_id` (backfilled by free-enrichment/`worker/external-data.py` chain) then a manual run of `worker/ko-aliases.py` (idempotent upsert-ignore; `--dry`, `--limit N`). No cron found — VERIFY.
- `/search` page (`app/search/page.tsx`): SSR `runSearch`, Watch vertical = kinds `tv,tv_list`; film spotlight calls `cinecodex_for(p_slug)`.

**New film:** lexical hit **immediately** on insert into `films` (no visibility filter on the film leg — Tier-2 included, flagged `is_catalog`); semantic once `takes.embedding` + `film_taste_vector` land. ⚠️ Adding a new `kind` requires simultaneous RPC+frontend deploy (`hrefOf` undefined → 500). ⚠️ IME guard, room-search must filter `is_catalog`.

## 5. `/random` + Surprise (`app/random/*`, `app/api/surprise/{home,set}`)

- `/api/surprise/home` → RPC `surprise_home()` (latest def `0055_surprise_home_figures_all.sql`, 20 modes). **Pool gate:** `films.visible AND coalesce(is_analyzed,true) AND exists(published take with take_title)`. Per-mode tables: `media (kind='video')` clip; `film_next` (watch_next/recommended_by); `film_asset` (why_watch); `director_picks`/`director_next` (where_to_start/director_next — fallback to misreading if missing); `film_reception (dek_lead not null)`; `film_lineage_for(f.id)` (honors/lineage); `questions` published; `film_locations`; `theorists` via takes; `film_affinities` (kindred); `figures` approved (figures mode); `figure_taxonomy`+`taxonomy_nodes` and `takes.trope_id`+`meta_takes` (film_tropes/film_ideas).
- `/api/surprise/set` → `surprise_set(p_kind,p_n,p_mix)`; `surprise(p_kind,p_mix)` (`0049_surprise_expand.sql`, 10 kinds: film/reading/concept/director/theorist/trope/figure/location/question/reception).
- `/random` renders `components/home2/SurpriseStage.tsx` (fetches `/api/surprise/home`); `/random/v2` = MetatakeTV kiosk.

**New film:** enters pool automatically at visible+published-takes; modes with missing side-tables silently fall back to misreading mode (graceful, but new films over-represent misreading until Stages 11–13 land). ⚠️ `create or replace` overload trap — drop old surprise signatures when changing (`0049` lesson). ⚠️ jsonb `items` empty-gate needs `jsonb_typeof='null'` check.

## 6. `/movies-like/[slug]` (`app/movies-like/[slug]/page.tsx`)

- Reads: `films` (source, gate `visible` for related), `film_affinities` (top-24/film with `shared_meta_take_ids`, `cos`, `tfidf`), `meta_takes` (reason chips, published figure_type), RPC `takescore_for_slugs` (bulk TS standard). `notFound()` if film missing. There is **no index page** — enumeration is sitemap-only (`lib/sitemap-data.ts` → one URL per visible film).
- `film_affinities` built by `worker/mt-recommend.py` driving chunked RPCs `conn_rebuild_stage_truncate → conn_stage_tfidf_chunk → conn_stage_knn_chunk → conn_affinities_swap` (needs `figure_type_members` + `film_taste_vector`). **Corpus-wide swap, not per-film** — new film has an empty movies-like page (renders with 0 recs; sitemap already advertises it) until mt-recommend reruns. ⚠️ Counterpoint rebuild is the 2 SQL blocks in `supabase/rpc/counterpoints.sql` header.

## 7. `/takescore` + Screener (`app/takescore/page.tsx`, `components/screener/*`, migration `0070_takescore_screener.sql`)

- RPCs: `cinecodex_ranked` (SSR first page; sources `cinecodex.scores` where `v_value`/`r_risk` not null × `films` × left `curation.film` (by tmdb_id) × left `film_ratings`), `cinecodex_ranked_mine` (Hide-seen, `p_mode exclude` over `user_movies.seen`; served via `app/api/lens/takescore/route.ts`), `cinecodex_histogram` (TS distribution brush), `cinecodex_countries`, `cinecodex_dim_histograms` (`/takescore/[dim]`), `provider_directory(p_country)`, `cinecodex_for(p_slug)` (film pages/search). Watch-country filter reads **`film_provider_index`** (~279k rows), a denormalization of `film_watch_providers.results` rebuilt only by **`fpi_rebuild()`** (full delete+reinsert).
- `/takescore/film/[slug]`: `cinecodex_card` RPC; unscored films (no `cinecodex.scores`) are private/absent.

**New film needs:** ① `film_watch_providers` row (`worker/external-data.py --persist`, env `TMDB_READ_TOKEN`,`OMDB_API_KEY`) → ② **manual `select fpi_rebuild();`** (⚠️ hook in external-data.py "대기/pending" per `HANDOFF-테이크스코어-스크리너.md` — importer must add this) → ③ `cinecodex.scores` row via the **paid LLM scoring run** (`score/cinecodex_score.py`, `score/run-cinecodex-visible.command`, Sonnet panel, Batch API; RUNBOOK `score/Cinecodex_RUNBOOK.md`; custom_id `{film_id}__{prompt_version}__{model_id}__s{n}`). Without scores: excluded from Screener/rankings/TS chips everywhere (left-join graceful). ⚠️ Screener CSS+page must land in one commit (auto-deploy watcher race); URL state uses server `searchParams` props not `useSearchParams`.

## 8. `/tv` (`app/tv/*`, migrations `0056–0064` tv_*)

- RPC `tv_watch(p_list, p_program)` over `tv_programs (status='published')`, `tv_segments`, `tv_playlists`, `tv_playlist_items`; `/tv` home defaults to playlist `palme-files`; `/tv/[slug]` per-film broadcast (`tv_programs.built_at` — NOT created_at); `/tv/list/[slug]` playlists; `/tv/lists` → RPCs `tv_directory`, `tv_directory_summary`.
- Per-film compile: `tv_compile_film(p_film)` gated by **`tv_eligible(p_film, p_min_rich=4)`**: requires `films.visible AND coalesce(is_analyzed,true)`, a `media kind='video'` row, published takes, then ≥4 richness points from {figures≥4, `film_reception.dek_lead`, `film_lineage`, `film_locations` w/ coords, `film_affinities`, `film_next`, `questions` published, `film_asset`, theorist takes, …}. Batch: `tv_compile_batch(p_limit,p_min_rich)`.
- Playlists: `tv_build_playlists` + axis family `tv_build_{lineage,director,genre,country,decade,theorist,trope,concept,…}_playlists` (thresholds: director ≥3, lineage ≥6, genre/country/decade ≥8, theorist ≥5, trope/concept ≥3) — **SQL functions run manually; not cron'd** (VERIFY).
- `EntityTVHero` (used on movies-like, director, lineage, etc.) → `/api/tv/reel` → RPC `tv_reel(p_slugs,p_cap)` over `media kind='video'` (trailer fallback when no broadcast); graceful omit when neither exists.

**New film:** NOT automatic — needs `tv_compile_film` run after richness lands, then playlist rebuild for axis membership; trailer-reel heroes work as soon as `media` has a video. ⚠️ `tv_*` tables had 0 RLS policies until `0059`; anon 3s timeout → `tv_watch`/`tv_reel` carry function-level `set statement_timeout`; hidden-tab autoplay renders black (testing trap); embed/hero headings must stay entity-specific (SEO).

## 9. `/room` + My Films lens

- `/room` (`app/room/page.tsx`): user RPCs `me_rate_stats`, `me_recent_ratings`, `me_portfolio_nav`, `me_nav_history`, `me_coverage`, `me_blindspots`, `me_pair_state` — these join `user_movies` × `film_taste_vector` × `films` (`0027_room_engine_coverage_blindspots.sql` etc.).
- Lens overlay APIs: `app/api/lens/{readings,entities,takescore}/route.ts` → RPCs `readings_mine`, per-entity fns, `cinecodex_ranked_mine`.
- **New film:** automatic once `film_taste_vector` row exists (else taste-cosine abstains for that film — graceful); ratable/importable immediately via `user_movies` (matched at import by tmdb/imdb id). ⚠️ Server HTML must never be personalized; lens is client `data-lens-film` opt-in; `.range` paging.
- `film_taste_vector` = materialized `l2_normalize(avg(takes.embedding))` per film (`docs/logic/phase2-taste.md` §3) — **no worker script; refreshed by SQL** after Stage 4 embeddings. VERIFY column name (`v` in plan vs `embedding` in `0040` RPC usage). Importer must include a per-film upsert.

## 10. `/now` + `/blog` film linkage

- `/now` (`app/now/page.tsx`): `now_articles`, `now_stream`, `now_digests` tables (hourly pipeline `hourly/pipeline/*.py`, poller `hourly/poller/poller.py`). `/now/wire` → `now_stream`. `app/news-sitemap.xml/route.ts` → `now_articles` + `now_digests`.
- Film "In the news": `app/film/[slug]/page.tsx:414` counts `now_articles where status='published' and film_slug=slug`. The Daily tab: `posts` where `entries` jsonb `@>` `[{film_slug}]` (line 256-257).
- **Poller beat gate** uses local snapshot `hourly/poller/entities.json`, refreshed by `hourly/poller/sync_entities.py` ("run daily"; paginates past the PostgREST 1000-row cap). **A new film is not news-matchable until sync_entities.py reruns** — importer must trigger it. Blog linkage comes from `worker/blog-ingest.py` matching entries to films.
- `/blog` + `/feed.xml` (`app/feed.xml/route.ts`): `posts (status='published')` — film-linked only via `entries`; new film needs no action beyond existing in `films` for future editions.

## 11. `/trending`, `/latest`

- `/trending` → RPC `trending_pool(p_window 'week'|'all')`, Data-Cache tag `trending`, pool {metas, takes, tropes, films}. `/latest` → RPC `latest_pool()`, pool {films, metas, tropes, directors, concepts, readings}.
- ⚠️ **Neither RPC definition exists in the repo** (no migration/rpc file) — applied directly to live DB. UNKNOWN/VERIFY exact sources & gates (trending presumably attention counters — `mt_events`/view counts; latest presumably `created_at` ordered, `visible`/`published` filtered). New film appears in `/latest` automatically if the RPC orders by films.created_at (VERIFY). Capture both into version control during importer work.

## 12. `/rag`

- `app/rag/page.tsx` → `app/api/rag/route.ts` → RPC `ask_retrieve(p_qvec, p_q, p_k)` — RRF fusion of pgvector (`takes.embedding <=>`) + FTS (websearch english) over `takes status='published'`, internal timeout 20s; plus `magazine_retrieve` (critics corpus `magazines`/reception embeddings). Env: `OPENAI_API_KEY`, optional `ASK_MODEL`, `RERANK_PROVIDER`+`COHERE_API_KEY`/`VOYAGE_API_KEY`, `ACADEMIC_FURTHER_READING`.
- **New film:** automatic once published takes have embeddings. ⚠️ Historical incident: bulk import doubled `takes` and the IVFFlat index degraded `ask_retrieve` to ~7s — after large ingests rebuild the HNSW/IVF index (`supabase/build-takes-hnsw.sql`; published-partial-index recipe per memory).

## 13. `/llms.txt`, `/feed.xml`

- `app/llms.txt/route.ts`: **fully static string; LEGACY** — describes the retired question/canonical-answer model (`/film/[slug]/q/[question-slug]`, community readings, upvotes). No data dependency; new films need nothing, but the file itself misdescribes the live site → importer project should flag for rewrite.
- `/feed.xml`: `posts` only (blog RSS) — no film dependency.

## 14. `/whereto/[slug]` and `/where-to-watch` (explicit answer)

- **`/where-to-watch`** (`app/where-to-watch/page.tsx`): the search/landing page ("find any film's streaming…"). Data: static **`lib/access_enrichment.json`** (keyed by `tmdb_id`; built by `worker/access-enrich-build.py` from `worker/access-enrich-seed.json`) joined to `films` by `tmdb_id` for the "well-filled" grid, + `SearchTypeahead` (→ `/api/search`). Films without an enrichment record just don't appear in the grid.
- **`/whereto/[slug]`** (`app/whereto/[slug]/page.tsx`): per-film where-to-watch ARTICLE (rule-based, LLM-0) + provider matrix (`WatchPageClient`). Reads: `films` (404 if absent; alias 308 via `resolveAlias` from `lib/aliases.ts`), `film_watch_providers` (results jsonb + countries, from TMDB/JustWatch via `worker/external-data.py`), `film_ratings` (OMDb), RPC `cinecodex_for(p_slug)`, `figures` (approved, ≤6 links), `media` (clips), `access_enrichment.json` record (free archives, MUBI-by-country, discs, subtitles). Robots: `pageRobots(film.visible !== false)` → noindex for hidden films; page renders even with no provider row (article degrades to what's on file). Sitemap gate (`whereToEntries` in `lib/sitemap-data.ts`): visible AND (`film_watch_providers` row OR access_enrichment record) — never advertises an empty page.
- **New film:** run `external-data.py --persist` (providers+ratings, resumable, skips existing) → page live within ISR 300s; access_enrichment is optional curated extra. `/watch` = 308 → `/tv` (LEGACY name).

---

## Cross-cutting importer facts

- **Master visibility gate:** `films.visible` flips via a **live DB trigger at ≥3 approved figures** — ⚠️ trigger NOT in version control (`RUNBOOK §Stage 14`, VERIFY/capture). Film page noindexes unless `figures>=3 && visible`; all sitemaps filter `visible=true`. A film extracting <3 figures stays silently noindexed — no alert exists.
- **Automatic once base tables filled** (no per-surface writes): search_all, /api/map ego views, /api/geo, surprise/home pools, home bundle rotation, /latest (VERIFY), movies-like page shell, /rag, room lens. These RPCs are read-only over the corpus.
- **NOT automatic — importer must schedule:** `mt-embed.py` (Stage 4) → `film_taste_vector` SQL upsert → `mt-recommend.py` (affinities) → counterpoints SQL → `trope-incremental.py` (additive trope assign; ⚠️ never run `trope-build --reset` per ingest) → Stage 18 sentence SQL → `ko-aliases.py` (needs wikidata_id) → `external-data.py --persist` + `select fpi_rebuild();` → cinecodex scoring batch → `tv_compile_film` + `tv_build_*` playlists → `geo-extract/geo-code` → `sync_entities.py` (hourly poller) → `crew-index-build.py` (static `lib/crew_index.json`, MIN_FILMS=3) → galaxy-build.py (quarterly only) → director Stage 15/16 for new directors (else director surfaces bare, surprise falls back).
- ⚠️ Global hazards: PostgREST 1000-row cap (bypass = jsonb_agg RPCs); `unstable_cache` null-poison (throw, don't cache empties); live-HTML audits right after deploy hit stale ISR (cache-buster); auto-deploy watcher only stages `app/components/lib` (root files manual commit); new-CSS+page single-commit rule; time-seeded cache keys forbidden.