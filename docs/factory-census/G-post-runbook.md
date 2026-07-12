# TASK G REPORT — Post-RUNBOOK Content Layers: Per-Film Ingest Obligations

Baseline: `docs/RUNBOOK-new-film-ingestion.md` (reconstructed 2026-06-24, Stages 1–18). Everything below is a layer shipped/extended after it, with what a NEW film requires. Cost legend: **LLM-0** = deterministic SQL/Python assembly, zero tokens; **LLM-paid** = model call; **EXT-API** = free external API.

---

## 1. Connections engine (`HANDOFF-연결엔진-커넥션.md`)

**Per-film obligation (RUNBOOK §4.3, run after Stage 3–7 land):**
- (a) `python3 worker/mt-recommend.py` — rebuilds `film_affinities` (~46k rows, top-24/visible film; RRF fusion of trope TF-IDF + `film_taste_vector` cosine) via chunked RPCs `conn_rebuild_stage_truncate` → `conn_stage_tfidf_chunk` → `conn_stage_knn_chunk` → `conn_affinities_swap` (atomic swap + cos backfill). Feeds /movies-like, film-page df-connected, /network 'like' edges. **LLM-0** (embeddings already exist from Stage 4).
- (b) Counterpoint rebuild — 2 SQL blocks in `supabase/rpc/counterpoints.sql` header comments (`conn_film_trope_vec` first, then `entity_edges kind='counterpoint'`, top-8 bidirectional per film). Read via RPC `film_counterpoints(slug,n)`. **LLM-0**.
- (c) New raw concepts only: `python3 worker/concept-embed.py` (report) → `--write 0.70` → `concept_map`. **LLM-paid (embeddings, cheap)**.
- (d) `film_next` backfill one-liner: `update film_next fn set target_film_id=f.id from films f where fn.target_film_id is null and f.tmdb_id=fn.tmdb_id;` (new film may be target of existing recs).
- (e) Galaxy coords (`worker/galaxy-build.py`) — do **NOT** run per film; quarterly-class event (t-SNE full reshuffle, seed 42). New directors: `worker/director-profiles.py` incremental only.

**Gates/missing-data behavior:** movies-like pages noindex when `film_affinities` empty (historic incident: 1,935 pages all noindex when table went to 0 rows). Page numbers derive at render — no bake.

**⚠️ Invariants:** never regress to `takes.meta_take_id` (retired hub pointers — using it zeroed film_affinities); never restore exact concept join (`concept_map` is canonical); DB functions must stay synced to `supabase/rpc/*.sql` (repo is source of truth); no `order by random()` in `map_ego`-family (determinism = cacheability contract); no hardcoded connection numbers (use `methodology_stats_json`); staging tables `conn_stage_*` are service-role only. `film_next_demand` view = ingest priority queue (`order by demanded_by desc`).

---

## 2. Lineage read layer (`HANDOFF-계보-SEO-읽는층.md` + `handoff/` bundle)

**Per-film obligation: NONE per-film — there is NO per-film lineage tagging step.** Membership is **list-driven**: `film_lineage` (10,551 rows) is populated per-LIST via Wikidata SPARQL (`wdt:P166` won / `wdt:P1411` nominated, `P4947` TMDb resolution) or published ranking lists (TSPDT excel, etc.) per `handoff/09_film_lineage_ingestion_spec.md` + `handoff/10_master_ingestion_runbook.md` (master-agent job; "lineage ingest pipeline is a separate session"). A new film picks up rows two ways: (i) list ingestion already created a stub film (`in_seed_catalog=false, visible=false, hold=true`) keyed by `tmdb_id` — Stage 1 `tmdb-resolve.py` upserts `on conflict tmdb_id`, so existing lineage rows attach automatically; (ii) future list refreshes resolve to the film via `tmdb_id`.
- ⚠️ `handoff/10` §6 tells you to recompute `film_scores` via `07_scoring_model.md` — **treat as LEGACY-hazard: `compute_film_scores` is a global-delete and is on the "절대 금지" list** in TV workorders; do not run it as part of ingest.

**Read surfaces (all auto-reflect, ISR 24h/30m + eligibility cache 1h):** `/lineage/[slug]` (gate LINEAGE_LIST_MIN=3 members), `/film/lineage/[slug]` (gate FILM_HONORS_MIN=3 rows; old `/film/[slug]/honors` = 308). Core module `lib/lineage.ts` (`cachedLineageEligibility` — **gate = measured `film_lineage` row count, never `lineage_lists.film_count`**), `components/FilmLineageSection.tsx` (HONORS_MIN=3 synced), sitemaps `lineage.xml`(~202)/`honors.xml`(cohort 500/895), `lib/seo.ts INDEX_COHORT_FILM_HONORS=500`. RPCs: `lineage_list_films(p_slug)`, `film_lineage_for(p_film_id)`, `lineage_index`. Missing data → tab/section hidden, page noindex/absent from sitemap (no 404 from advertised URLs — same rule everywhere).

**Cost:** LLM-0 + EXT-API (Wikidata/TMDb).

**⚠️ Invariants:** honors pages have **no `films.visible` gate** (awards are facts — Tier-2 included, per owner directive "1,900편 한정 금지"); `lineage_sources` table is EMPTY — display-name map `LINEAGE_SOURCES` in `lib/lineage.ts` is canonical; never invent source names (fallback = raw code); dates from `cachedLineageMeta()` (max created_at), never render date; no "· Metatake" in titles; cache keys `lineage3`/`film-honors2`/`lineage-eligibility`/`lineage-meta` — bump on payload change; `KNOWN_TRUE_SIZE` = published definition sizes only; title fuzzy-match pollution exists (8 rows fixed, backup `curation._bak_film_lineage_20260711`).

---

## 3. Sentence layer / Embedding Fantasia (`HANDOFF-임베딩판타지아-문장층.md`, `sentence-engine/MASS-PRODUCTION.md`)

**Per-film obligation (= RUNBOOK Stage 18, run AFTER Stages 3–7):** idempotent SQL re-run via MCP `execute_sql`, in order: ① `sentence_node_stats` upsert → ② `sentence_concept_stats` upsert → ③ `film_kinship` upsert → ④ 13 pattern INSERTs (all `ON CONFLICT DO NOTHING`; only new film's rows land). SQL lives in `sentence-engine/MASS-PRODUCTION.md`. Per-film increments are trivial; corpus-wide G/I self-joins need the unlogged scratch table + `film_id::text` hex-bucket recipe. **LLM-0, $0.**

**Tables:** `film_sentences` (466,974 rows, 13 patterns A/B/C/D/E/F/G/H/I/J/L/M/N_question; every value is an entity FK + `nums` jsonb + `kin`/`salience`), `film_kinship` (27,593 pairs, kin = cos·40+tfidf·25+rarity·35), `sentence_node_stats`, `sentence_concept_stats`. Migrations 0061–0069. RPCs (all with function-level `set statement_timeout='8s'` to beat anon 3s default): `film_sentences_for(slug,limit,patterns,per_pattern)` (⚠️ old 3-arg signature DROPPED in 0066), `sentences_for_entity`, `sentences_ticker(n)`, `sentences_sample`, `map_film_ego`/`map_film_overview` (kin edge weights; ⚠️ 0-arg legacy overload of overview exists — **do not add overloads**).

**Gates/missing-data:** film module (`FilmSentences.tsx` df-know) hides below 2 rows — graceful. H_dense only for rated films; `takes.status='published'` gate everywhere (46,503 retired takes must never leak).

**⚠️ Invariants:** LLM 0 · random() 0 (time-seeded md5(UTC) determinism); v1 factual style is canonical (v2 WOW = reference only); brand contract — kicker "a data fantasia by Wonwoo Yoon" + "Not AI-written … independent of the filmmakers' intent" disclaimer **must not be removed**; every sentence starts with the film title/possessive; links via `lib/urls.ts` helpers only (chips, no substring linkification); loaders throw on error (null-poison guard). Title change = per-pattern delete + re-insert (text drift). Closed items (do not redo): concept/frame fantasia impossible; `/take` restoration OBSOLETE (retired old model); K_counterpoint unimplemented (table naming mismatch — note it DOES exist as `entity_edges kind='counterpoint'` per layer 1; sentence doc recorded "no table" — VERIFY before adding K).

---

## 4. to.W curation comment layer (`HANDOFF-투두블유-큐레이션코멘트.md`)

**Per-film obligation:** a NEW film needs a row in `curation.film` (curation master, keyed `tmdb_id`; columns `director`, `manual_override`, `curator_note`, `national`, `country_code`) and a computed `curation.film_comment` row (11,630 rows: 6 dimension grades authority A–D / recognition 1–4 / entry_path / national / movement / verdict + assembled English `rationale`). **Recompute mechanism: SQL rules documented in DB table `curation.rule` (keys `comment.*`, `lineage.fix-*`) — this table is the DB-side canon; no repo worker script exists → UNKNOWN/VERIFY how new-film rows are inserted (manual SQL per curation.rule).** Verdict is a decision function of (authority × recognition) derived from lineage memberships + `curation.auteur_director` (337). **LLM-0** entirely.

**Verdict rules v2 (must reproduce for new films):** A(essential) = canon lists ONLY (`tspdt-1000`, `sight-and-sound-critics`, `sight-and-sound-directors`) — ⚠️ award lists never grant A (old bug made Green Book "essential"); B = canon T2/T3 + Big-3 grand prizes + auteur facet + auteur promotion — ⚠️ exclude `nbr-top-ten`/`national-film-registry` from B; auteur promotion only `canon_portfolio`/`auteur_list` reasons and only C/D × recognition 3·4. Honesty rules: `comment.lowscore` (authority A/B but TakeScore `v_value − r_risk` < 20 → no "canon" in headline), `comment.optional` humble template.

**Surfaces & RPCs:** `tow_comment(p_slug)` (security-definer, 4s timeout) → `components/read/TowCard.tsx` on `/takescore/film/[slug]` and `/film/[slug]` (both thin+full branches); `director_curation(p_slug)` (5s) → `.dr-tow` card on `/director/[slug]` (null if non-optional=0); `for_w_heo_films()` (8s) → `app/lineage/for-w-heo/page.tsx`. Front cache `unstable_cache` keys `tow-comment1`/`director-curation1`, revalidate 3600.

**Gates/missing-data:** no `curation.film_comment` row → TowCard simply absent (graceful). Unscored optional films 404 on `/takescore/film` (page requires `cinecodex_card`). `curation` schema is NOT PostgREST-exposed — public access only via the security-definer RPCs.

**⚠️ Invariants:** any verdict recompute UPDATE must include `where cf.manual_override is not true` (Fahrenheit 9/11 locked to popular_not_cinephile); rationale never in JSON-LD (template text ≠ reviewBody); director-name matching uses `public.unaccent` (schema `public`, not `extensions`); footnote possessive `{title}'s place` (JSX whitespace loss); new deploy files — don't manually `git commit` files the watcher stages (stranding hazard).

---

## 5. Korean i18n master (`HANDOFF-한국어화-i18n-마스터.md`)

**Status: DESIGN ONLY — NOT IMPLEMENTED.** No `content_i18n` table, no `i18n_registry`, no i18n worker/migration in repo (verified by grep; migrations end at 0080-range). So today a **new film's text is NOT auto-queued for KO** — wave ⓪ (glossary, owner-approved) must land first.

**Designed autonomous loop (what the importer should assume once built):** side table `content_i18n(entity_type, entity_key, field, lang, source_sha256, text, model, status, translated_at, reviewed_at)`; reconciler detects work items = missing ko row OR `sha256(current EN) <> source_sha256`; cron-A collects+submits (≲50 → sync parallel, else Opus Batch, custom_id `{entity_type}:{shortkey}:{field}` ≤64 chars, effort=low), cron-B polls/harvests → upsert + ISR revalidate + IndexNow, cron-C 5% QA sampling. **Content kinds registered:** take(takes.take_title,rationale — published only), essay(essays — verified only), figure(figures — approved only), meta_take(published only), reception(film_reception headline/comment/verdict/dek_lead), taxonomy(taxonomy_nodes), concept(theory_concepts). Layer B (film_sentences 67.9M chars, tv_segments, tv_playlists, TakeScore prose) = **generator i18n, LLM-0 — never put them in a translation batch**. Layer C (films.overview/tagline, titles) = TMDB `language=ko-KR` + KOBIS join, $0.
- Existing partial KO: `/film/x/[desk]/ko` essays (293 indexed) via `worker/engine-translate.py` (Sonnet 5 translate + Haiku translation-lock check) — engine-pipeline-specific, LEGACY relative to the master loop.

**Cost:** one-time backfill ~$220–240 Opus 4.8 Batch (7.3M in / ~14M out tokens); incremental per new film ≈ cents. **⚠️ Invariants:** effort=low is the cost lever (thinking tokens bill as output); brand names stay English; `/ko/` subdirectory + self-canonical + hreflang (never canonicalize ko→en); no IP auto-redirect (Googlebot); render cache keys must include locale.

---

## 6. Director article layer + Reception/Afterlife (`HANDOFF-감독읽는층-리셉션-SEO.md`)

**Per-film reception obligations (Stage 11 extended):**
1. Critics/academic rows → `film_reception` (9,245 rows; columns incl. `dek_lead`, `review_year` from migration 0048): run `magazine research agent/reception-run.py` (resumable, per-slug JSON in `reception_out/`, skips done films — new film = incremental run) → `reception-load.py` (idempotent delete+reinsert per film). **LLM-0, ~$0** (Brave free tier 1 query/film, OpenAlex/Crossref/og free). Academic backlog fills via autonomous chain `magazine research agent/openalex-chain.sh` (nohup+caffeinate, lock, **1 worker only — 4 workers = 429 storm**).
2. Release events → `worker/release-events.py` (TMDB) → `film_release_events` (83,223 events). **EXT-API.**
3. Wikidata honors → `worker/wd-honors.py` → `film_wd_honors` (7,466). **EXT-API.** ⚠️ qualifier dates are `pqv:P585` (psv strips all dates).
4. Optional LLM reception essay: `worker/film-features.py` (kind=reception, plus pitch/record/experience — **uses Gemini** `gemini-3.5-flash`/`2.5-flash`, 2 calls/film, `GEMINI_KEY`) → `film_features`; upsert-skips complete films, `--film <slug>`.

**Surface/gates:** `/film/[slug]/reception` ("What Critics Said, and Everything Since", 4-source LLM-0 assembly; **noindex if reception+honors combined <3**); ⚠️ original `film_reception.year` column = film release year on every row — **never use** (use `review_year`). Film loader cache `film-load6`. Director sub-layer (start/next/life/misreadings/takescore/honors/reception/theory) is **per-DIRECTOR** (Stage 15 scripts `director-{profile,facts,picks}-*` — Opus Batch), gated by `directorLayerEligibility()` in `lib/sitemap-data.ts` (≥3/≥3/≥3/≥5/≥5 mirrors robots gates); a new film increments an existing director's counts automatically.

**⚠️ Invariants/hazards:** **`cinecodex_card` loop = DB down (3 recurrences)** — any aggregate/director-level scores must use `lib/takescore-bulk.ts cachedRankedScores()` (one `cinecodex_ranked` call, daily cache); loaders must throw on DB error (null-poison 404); RSC comment nodes break substring greps; `director_picks`/`director_next` >1000 rows → PostgREST cap, paginate.

---

## 7. Intent Coverage / QuickAnswers (`docs/PLAN-intent-coverage.md`) — Waves 0–5 SHIPPED 2026-07-11

**Per-film obligation: NONE.** Fully render-time, **LLM-0**, zero extra fetches — `components/read/QuickAnswers.tsx` assembles Q&A from data already in each page's render scope (`film_geo`, `film_lineage_for`, `film_reception`+`film_release_events`, `takes`, `film_affinities`, `cinecodex_card`, TMDB credits...). A new film gets Quick answers automatically wherever its underlying data exists; **questions without a non-null answer field are never generated** (verified live: idiocracy "skyline" query stayed in queue because pin data lacked it).

**Detector:** `worker/0079_intent_queue.sql` (+`0080` bot-noise filters) — `intent_queue(page, query, imps, wpos, status, first_seen)` fed by `mt_intent_scan()` piggybacked on the 30-min insights cron reading `mt_gsc_daily`. Statuses new/answered/covered/rejected.

**⚠️ Invariants (charter):** no question without an answer; entity strings must match source rows verbatim (machine-verified, not LLM); LLM (if ever) phrases only, facts from rows; 3–6 Q per page, skip if body already answers; variant weaving 2–3 terms, same variant ≤2×, grammatical, truthful — comma keyword lists = stuffing = forbidden; "best" questions only where a real ranking field exists (rank/demand/ts); lineage: no person-level nominations (rows are film-level), `edition_year ≠ film_year`; misreadings: never "ending explained"/factual framing; movies-like: no "on Netflix" (no provider join in that view); measure via GSC before expanding.

---

## 8. TakeScore / Cinecodex (`docs/PLAN-cinecodex-integration.md`, `docs/WORKORDER-cinecodex-scoring.md`, `score/Cinecodex_RUNBOOK.md`)

**Per-film obligation: score the new film — currently the explicit gap.** PLAN "Not done / future": *"New films: score on ingest (add to the new-film pipeline)."* Run: `score/cinecodex_score.py` (+ `run-cinecodex-*.command`, operator Mac — Cowork sandbox blocks the Anthropic API). **LLM-PAID**: Anthropic **Message Batches API**, primary `claude-sonnet-4-6` N=1 temp=0.6 B=8 films/request, prompt `cinecodex-prod-v2` (SHA `d0654eaa…`, frozen in `cinecodex.prompt_versions`), system block `cache_control:ephemeral`; flagged ~15% → Sonnet N=3; audit → `claude-opus-4-8` N=3 (Haiku forbidden). ~$0.001–0.005/film Pass 1 (whole 6,701 catalog ≈ $10). Resume idempotent via `cinecodex.scoring_runs` unique(film_id,prompt_version,model_id,sample_index); async batches tracked in `cinecodex.batch_jobs`; monitor `public.cinecodex_progress()`. Aggregate = **median per each of 13 sub-scores THEN** V=(COG+AFF+FORM+MORAL+DUR)/5, C=(ITX+FR+ETX+CTX)/4, R=0.6·(BANK+INSINCERE+COWARD)/3+0.4·POLAR → upsert `cinecodex.scores`. Drift gate: 60-anchor control set (`cinecodex.anchor_controls`, ±12 tolerance, >10% out → pause) before each ~1,000-film chunk or model/prompt change.

**Gates/missing-data:** unscored film → `/takescore/film/[slug]` **404** (page requires `cinecodex_card`); film-page CinecodexPanel absent; Screener (`cinecodex_ranked`) excludes it; to.W on /takescore/film absent. Reader RPCs: `cinecodex_for(slug)`, `cinecodex_ranked(...)`, bulk standard `takescore_for_slugs` (film pages/home) and `lib/takescore-bulk.ts` for aggregates.

**⚠️ Invariants:** **NEVER blend** IMDb/RT/Metascore/canon into the score (display/validation only; `public.film_ratings` side-by-side); `cinecodex` schema isolated, keyed `film_id uuid → public.films(id)` — never touch `public.films`/`public.film_scores`; only the 8 in-prompt reference anchors go in requests (520-anchor bank stays offline); pin model snapshot, no auto-upgrade; prompt change = new version+SHA (`cinecodex-prod-v2-note` separate); TS = round(Value − λ·Risk); page prose is rule-based (`lib/takescore_prose.ts`, LLM-0) — only the scores cost money.

---

## 9. Tier-2 / thin-film path (`docs/PLAN-tier2-almanac.md` + tier2-free-enrichment)

**A THIN film (no figure extraction) still gets, at $0 LLM:** TMDB overview/poster/genres (Stage 2), `film_ratings`, `cinecodex_confidence` tier render, `film_watch_providers`, `film_lineage` memberships, `film_locations` pins (Atlas display opened to Tier-2 via migration `atlas_display_include_tier2_pins`), inbound `film_next` recs, credits, free enrichment recipe `worker/external-data.py --persist` (`--shard` 5-parallel; backfills imdb_id/credits/releases/awards/wikidata_id — memory: is_analyzed=false pages looking broken = `hasDigest=false` from missing surrounding data). Renders the **Tier-2 catalog template**: Editor's digest lead (deterministic assembly, inbound-rec quote, prestige/discovery chips), Atlas minimap (`film_geo` has no visible filter), lineage ribbon, credits, whereto. `noindex,follow` + crawlable funnel.

**Promotion is fully automatic:** live DB trigger flips `films.visible=true` at **≥3 approved figures** (auto-reverses; ⚠️ trigger NOT in `supabase/migrations/` — applied direct to live DB, VERIFY/capture). Promotion chain = Track C engine wave: `film-extract-batch.py` (Opus Batch) → bold-take → embed → `trope-incremental` → trigger opens indexing/sitemaps/modules with no manual step.

**Gates:** film page noindex unless `figures>=3 && visible`; site search includes Tier-2 since `search_site` v2 (0.8 discount + "catalog" chip `is_catalog`); `/whereto/[slug]` robots gate = visible-only indexing. Track B selective indexing (module≥2 & IMDb≥10k ≈ 563 films, `films2.xml`) still pending owner review.

**⚠️ Invariants:** minimal-payload shape change ⇒ bump film loader cache key (currently `film-load6`); no mass prose generation to "look full" (scaled-content-abuse risk); `compute_film_scores` forbidden (global delete + needs lineage); reception loader TDZ 500 trap; `REMEMBER-thin-content-gate.md` is stale — this PLAN supersedes.

---

## 10. TV layer (`docs/WORKORDER-tv-corpus-build.md`, `-tv-strategic-playlists.md`, `-tv-hero-unification.md`)

**Per-film obligations (all LLM-0, SQL via Supabase Management API `POST https://api.supabase.com/v1/projects/jvgarcqrtsmgfimdcwgo/database/query` with `SUPABASE_ACCESS_TOKEN` — `worker/apply-sql.py` blocks DDL):**
1. **Broadcast compile:** `select tv_compile_batch(20, 4)` — idempotent, processes only uncompiled films → `tv_programs` (1 row) + `tv_segments` (~12–18 chapters: open·misreading×3·theorist·figures·ideas·why_watch·reception·question·honors·canon·locations·map·kindred·watch_next·invitation·close). Single film: `select tv_compile_film('<film_id>')` (delete+rebuild). Eligibility gate `tv_eligible(film_id, p_min_rich=4)`: requires `visible AND is_analyzed`, a clean trailer/teaser in `media` (kind='video', title regex excluding featurette/review/etc.), ≥3 titled published takes, rich≥4 of 10 data families. Fails → `tv_programs.status='skipped'` + `meta.skip` reason (excluded from `tv_watch`, no re-probe). In practice trailer presence decides (rich<4 skipped 0 of 1,935).
2. **Playlists do NOT auto-include the new film** — membership is baked into `tv_playlist_items` (delete→reinsert on rebuild, cap 40/list). After compiling: `select tv_build_all_playlists();` (small axes only: lineage/director/genre/country/decade/theorist/genre_topic, `pg_sleep(2)` between) + rerun batch runner `worker/tv-build-playlists.py` for the big 3 axes (trope 2,859 / archetype 1,535 / concept 588; `p_batch=300`, 20s sleeps + healthcheck `curl https://metatake.net/api/surprise/home`). Upsert keyed `(axis,key,cut)`; slug immutable after creation.
3. **Reels are automatic:** `tv_reel(slugs[],cap)` (0061) + `/api/tv/reel` + `components/EntityTVHero.tsx` fallback chain (playlist broadcast → trailer reel → omit hero) reads `media` live — a new film with a trailer joins entity reels with no step.

**Gates/missing-data:** no broadcast → film hero falls back to plain trailer; no trailer → hero omitted (page intact). Playlist embeds (`PlaylistTVEmbed`) render null on empty. Axis gates: lineage≥6, director≥3, genre/country/decade≥8, theorist≥4(top150), trope/concept/archetype≥3.

**⚠️ Invariants/hazards:** advisory locks 777001 (compile) / 777002 (playlists); statement_timeout in every function (batch 120s; anon RPCs need function-level `set statement_timeout` — anon default 3s); **never** `compute_film_scores`, cinecodex_card loops, full-table index builds, wide multi-join aggregates (2 real site-down incidents); tv_watch signature frozen (CREATE OR REPLACE overload trap); new tv_* tables need RLS SELECT policy (0059 — silent 0 rows otherwise); no leading `The %s` templates (double-article, 214 segs); no counts in titles (stale); jsonb null gate = `jsonb_typeof(...)='array'`; `lineage_lists.status='merged'` and `frames.merged_into is not null` excluded; theorist/trope **segments-cut forbidden** (segment's theorist ≠ playlist entity until compiler v3 stamps `tv_segments.meta`); heading text must be entity-specific (SEO); crew playlists impossible (no person→film DB mapping; needs a `film_credits` table first); `built_at` ≠ created_at.

---

## 11. Film-naming 8-axis batch (`Outputs/film_batch` — **directory does NOT exist in repo**; toolkit lives outside at `…/local-agent-mode-sessions/…/outputs/film_batch/`)

One-off 8-axis "universal→emic momentum" naming over `films.visible=true` (~1,935) via Anthropic Message Batches API, Opus 4.8, ~$145/1,900 (~3.5K tok/film). Tables (new, films read-only): `naming_jobs` (claim via RPC `claim_naming_jobs(n)` FOR UPDATE SKIP LOCKED), `film_namings`, `film_axes` (8 rows/film), `film_axes_view`. DB access = PostgREST (`db_rest.py`, service-role key from `.env.local`); scripts `batch_submit.py` → `batch_poll.py`.
**Per-film ingest verdict: NOT currently a per-film ingest obligation** — grep shows **no `film_axes`/`film_namings` consumption in `app/`, `lib/`, or `components/`** (VERIFY DB-side/RPC consumption; appears to be dormant data). New films are not auto-named; if the data is ever surfaced, the importer should append visible new films to `naming_jobs`. Standing lesson (invariant): any bulk Opus generation over the corpus goes straight to the Batches API — subscription multi-agent fan-out hits server concurrency throttles + session token limits.

---

## 12. Magazine research agent (reception 4-source pipeline, `magazine research agent/`)

**Pipeline (per-film capable, all LLM-0, ≈$0):**
- `magazine-allowlist.csv` (150 outlets, robots/AI-stance/ingest_recommendation routing table) + `magazine-contacts.csv` (288) — static assets, reusable.
- `reception-discover.py` — pilot logic (hardcoded FILMS list), reused as module by:
- `reception-run.py` — production: pulls films from Supabase `films` REST, ThreadPool + Brave global throttle (~1 req/s free tier, 1 query/film), resumable (`reception_out/<slug>.json`, skips done → **new film = just rerun**), writes `reception-all.jsonl` + `reception-run-summary.md`. Sources: page `og:description`/meta/JSON-LD deks (criticism) + OpenAlex `abstract_inverted_index` → Crossref fallback (academic).
- `reception-load.py [--dry]` — `reception-all.jsonl` → `film_reception`, idempotent per-film delete+reinsert, service-role key; also loads `dek_lead`/`review_year`.
- `openalex-chain.sh` — unattended academic backfill chain (nohup+caffeinate, lock file, fill→load); **1 worker only (429)**.
- `comment_extractor.py` / `render_box.py` — the original single-film box tooling (Barbara); superseded by run/load for site ingest, keep for one-off boxes.
- `dek-refresh.py` — dek re-harvest utility (VERIFY exact scope).

**⚠️ Copyright invariants baked into code:** publisher-published fields only (titles, deks/og:description, abstracts); ≤10-word (extractor) / ≤15-word (site standard) verbatim verdict, substring-verified (`verbatim_verified`), one quote per outlet, no body scraping/storage, robots respected, real URLs/DOIs only, 1s rate limit. Boilerplate-dek stripping + academic false-positive gate.

---

## 13. Hourly news linkage (`HANDOFF-now-플레잉.md`, SKIM)

**Per-film obligation: none manual.** `hourly/poller/sync_entities.py` syncs **ALL films** (`films?select=slug,title,year,director,director_slug,is_analyzed` — Tier-2 included, analyzed films just score higher) + derived directors + theorists into `hourly/poller/entities.json`, stated cadence "일 1회" (daily) — **scheduler not visible in `now-playing-watch.sh`; VERIFY how/whether it actually runs daily vs manually**. `poller/poller.py` uses entities.json for the beat gate (trending keyword must match an entity; beat<4 dropped, not even wire); if entities.json missing, beat gate is disabled for that run. So a new film enters news-matching automatically on the next entity sync. Film pages show news via `components/EntityNews.tsx` ("In the news" — renders only when matching articles exist; graceful absence). Article generation itself is **LLM-paid (Fable5 + web search)** but event-driven, not per-film ingest.

---

## Cross-layer synthesis for the importer factory (per NEW film)

| Order | Step | Cost | Blocking gate it unlocks |
|---|---|---|---|
| RUNBOOK 1–17 | (baseline — resolve→TMDB→extract→embed→hubs→tropes→catalog→reception→next→asset→geo) | mixed | visible trigger @ ≥3 figures |
| +Conn (§4.3) | mt-recommend + counterpoint SQL + concept-embed + film_next backfill | LLM-0/embed | movies-like index, df-connected, kin |
| +Sentences (St.18) | 4-step idempotent SQL | LLM-0 | Fantasia modules, ticker, kin edges |
| +Reception | reception-run→load, release-events, wd-honors, (film-features Gemini) | ~$0 / Gemini | /reception noindex→index @ ≥3 |
| +TakeScore | cinecodex batch (Sonnet) — **not yet wired to ingest** | ~$0.005/film | /takescore/film 404→200, Screener, to.W lowscore rule |
| +to.W | curation.film + film_comment recompute (VERIFY mechanism) | LLM-0 | TowCard |
| +TV | tv_compile_batch → playlist rebuild (small axes fn + big-3 runner) | LLM-0 | film TV hero broadcast, /tv/[slug], playlist membership |
| +Lineage | none per-film (list-driven, tmdb_id auto-attach) | — | honors tab @ ≥3 rows |
| +i18n | nothing today (loop unbuilt) | future ~¢ | /ko |
| +News | sync_entities.py next run | $0 | beat-gate matching |

**Global invariants that bind every layer:** LLM-0 for all page prose assembly; no 404 links (eligibility gates everywhere, threshold usually ≥3); `unstable_cache` key bump on payload change + throw-on-error (null-poison); watcher stages only `app/components/lib` (supabase/, docs/, root files manual commit); CREATE OR REPLACE overload trap (drop old signatures); PostgREST 1000-row cap (jsonb_agg single-row); anon 3s statement_timeout (function-level override); ISR stale-cache false negatives in live audits (cache-buster); deploy-churn sitemap DB overload (check Vercel deployment status, empty-commit rebuild if ERROR); never `compute_film_scores`, never cinecodex_card loops, never `takes.meta_take_id`.