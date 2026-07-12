# TASK A — PIPELINE DOCS SYNTHESIS (film importer factory recon)

Sources read in full: `docs/RUNBOOK-new-film-ingestion.md` (reconstructed 2026-06-24), `docs/BACKLOG.md` (2026-06-24), `docs/STATE.md` (verified 2026-07-02, with 07-04~11 addenda), `docs/FRONTEND-DISCOVERY-AND-DECISIONS.md` (2026-06-27), `GEO_운영-신규영화-증분처리.md` (2026-07-03), `handoff/10_master_ingestion_runbook.md` (lineage v1), `RUNBOOK-metatake.md` (LEGACY), `RUNBOOK-EngineRoom.md` (2026-07-03).

## (a) The 18-stage master pipeline (RUNBOOK-new-film-ingestion.md §3)

**Governing principle (§0):** two stage classes. PER-FILM stages (1–3, 11–13, 15, 17) are naturally parallel, never touch existing films → automatable. CORPUS-WIDE stages (4–9, 16, 18) re-cluster/re-rank the whole published corpus and can rename/re-link live entities → stay supervised; automation goal = additive-only incremental mode (§6).

**Existing orchestrators (§1):**
- `worker/run-pipeline-auto.command` — P0 wait → P3 embed → P4 consolidate → P5a author → P5b rank → P5c recommend (unattended, idempotent)
- `worker/run-pipeline-finish.command` — P0 wait → P6b trope-build → P8 SEO (stops before P9)
- Manual/supervised: Stages 1–3 (resolve/TMDB/extract) and Stage 14/P9 (integrity + deploy)
- `pipeline-wait-batch.py` / `pipeline-wait-tropetag.py` = P0 gates; they guard *timing* only (block until table writes go quiet), not correctness.

**Models:** Opus `claude-opus-4-8` (film-extract, bold-take/asset, figure-enrich, hub authoring, trope naming/gate); Sonnet `claude-sonnet-4-6` (watch-next, catalog/archetype); Haiku `claude-haiku-4-5` (SEO phrases); embeddings OpenAI `text-embedding-3-small` 1536-d. Anthropic Batch API (~50% off) used by: `film-extract-batch`, `bold-take-batch`, `asset-batch`, `next-batch`, `mt-seo-batch`, `catalog-map-run`/`catalog-map-char`, `trope-gate-batch`.

| # | Stage | Scripts | Class | Writes | Key constraint/gate |
|---|---|---|---|---|---|
| 1 | Title→tmdb_id (director-disambiguated) | `worker/tmdb-resolve.py` (`run-tmdb-resolve*.command`) | PER-FILM, manual gate | `films(tmdb_id,title,year,director,director_slug,slug)` on conflict tmdb_id; high/medium confidence only unless `--include-low`; slug=`slugify(title)-year` w/ collision avoidance | ⚠️ low-confidence rows silently dropped/held — must eyeball; wrong director match attaches entire downstream graph to wrong film |
| 2 | TMDB metadata+media | `worker/tmdb-fetch.py` (`run-tmdb-fetch-new.command`) | PER-FILM, parallel | `films`(overview,genres,backdrop,tagline,runtime,release_date,certification,poster_path,tmdb_extra=cast), `media`(backdrops,trailer,director profile — deletes prior AI media first, idempotent), `directors` | ⚠️ MUST precede Stage 3 — missing genres/overview → film clusters as genre "Other", extract loses cast context |
| 3 | Figures+takes (the content) | `worker/film-extract-batch.py` (`--submit`/`--fetch`, Batch, Opus); then Strong-Misreading layer: `worker/bold-take-gen.py` → `bold-take-batch.py` → `boldtake-load.py` | PER-FILM, batch | `figures` (6–8/film), `takes` (3 frameworks/figure, status=published); bold-take writes `takes.framework`, `is_invitation`, theorist/concept, may create new figures. Idempotent (skips films with figures) | ⚠️ bold-take load creates figures with worker-assigned UUIDs — must land BEFORE P3 embed |
| 4 | Embeddings (P3) | `worker/mt-embed.py` (`run-sm-embed.command`) | CORPUS-WIDE (null-only unless `--force`) | `figures/takes/meta_takes.embedding` | must precede 5/6/7 |
| 5 | Hub consolidation+re-link (P4) | `worker/mt-consolidate.py` (+`mt_consolidate_core.py`) `--persist`; quality mode (supervised): `mt-recluster.py`, `mt-dedupe-rename.py`, `mt-retitle-splits.py` | ⚠️ CORPUS-WIDE FRAGILE | dedups hubs (cosine ≥0.86), gates <5-film hubs, splits >70-figure hubs, re-links `takes.meta_take_id`, retires merged hubs via `merged_into` | ⚠️ generates new hub slugs, re-links takes corpus-wide; recluster/dedupe/retitle rename live hub titles/slugs and null `seo_phrase`; URL integrity depends on `merged_into` + `slug_history` redirects. NOTE: hub layer = `kind='reading'` = LEGACY unpublished (retired model) — incremental variant `mt-consolidate.py --incremental` is BACKLOG low-priority |
| 6 | Author→Rank→Recommend (P5a/b/c) | `mt-author.py` (Opus, publishes hubs ≥5 films, publish-then-audit), `mt-rank.py`, `mt-recommend.py` (2026-07-04 rewrite: `film_affinities` = trope TF-IDF + `film_taste_vector` cosine fused by RRF, top-24/film, evidence cols `cos`/`tfidf`/shared trope ids; runs via chunked `conn_*` RPCs; SSOT `HANDOFF-연결엔진-커넥션.md`) | CORPUS-WIDE | `film_affinities` — drives /movies-like, film-page Connected, network 'like' edges | ⚠️ hubs never reaching 5 films stay unpublished candidates forever (author/rank legs mostly LEGACY-hub-facing; recommend leg is live-critical) |
| 7 | Tropes: tag→build (P6) | `trope-tag.py` (1 call/film) → `pipeline-wait-tropetag.py` → `trope-build.py --persist --reset` (P6b); quality re-form: `trope-form.py` → `trope-gate-batch.py` → `trope-consolidate(-apply).py` → `trope-persist.py` | ⚠️ CORPUS-WIDE FRAGILE | `figure_tags`; `meta_takes(kind=figure_type)` + `figure_type_members`; centroids/related; `takes.trope_id` | ⚠️ `trope-build --reset` WIPES all trope hubs+members, recreates with new slugs; `trope-persist --apply` retires ~1,400 tropes/clears ~45k members; reversible only via local `_bak_trope_*` snapshots. **Additive replacement EXISTS: `worker/trope-incremental.py` + RPC `trope_match_takes`** (cosine to trope centroid = `meta_takes.embedding`, default threshold 0.72; writes `takes.trope_id` + `figure_type_members` via `trope_set_take_tropeid`/`trope_insert_members` RPCs; DRY default; `--films <slug,slug>` or `--all-null`; button `run-trope-incremental-dry.command`) — never renames/deletes existing |
| 8 | Theory import+tradition match | `worker/theory-import.py` → `theory_canon` | ⚠️ GAP (manual) | tradition matching NOT automated — script prints "tell Claude to run tradition backfill" | BACKLOG: build worker (trigram → embedding match `raw_concept` → `theory_canon`) |
| 9 | Per-page SEO phrases (P8) | `worker/mt-seo-batch.py` (Batch, Haiku) | CORPUS-WIDE, null-only | `meta_takes.seo_phrase` | ⚠️ must re-run after any hub rename (recluster nulls it); covers hub phrases only — per-film SEO intros = gap |
| 10 | Catalog/archetype mapping | `catalog-load.py` (one-time `taxonomy_nodes` from `Element/*.xlsx`) → `catalog-map-run.py` (objects/locations) + `catalog-map-char.py` (characters), Batch, Sonnet | PER-FILM-ish, resumable | `figure_taxonomy` | — |
| 11 | Reception (critics) | `reception-discover.py` → `reception-run.py` → `reception-load.py`; LLM essays: `film-features.py` (kind=reception) | PER-FILM | `film_reception` (headlines + ≤15-word verbatim verdicts + link, copyright-safe), `film_features` | — |
| 12 | Watch-next (+reverse) | `next-gen.py --emit-requests --all` → `next-batch.py submit/fetch` (Batch, Sonnet) → `next-resolve.py` (DB match/TMDB verify/drop hallucinations) → `next-load.py` | PER-FILM, batch | `film_next`; reverse = `film_next_reverse` RPC | — |
| 13 | Why-watch/asset | `asset-gen.py` → `asset-batch.py` → `asset-load.py` (Batch, Opus) | PER-FILM, batch | `film_asset` (8 lenses) | RUNBOOK says "0 rows loaded" — STALE: BACKLOG marks DONE, `film_asset` = 1,957 live |
| 14 | Visibility+deploy (P9) | live DB trigger + `deploy-*.command` (git add/commit/push → Vercel ~2min) | AUTOMATIC + supervised | `films.visible` flips automatically at ≥3 approved figures (auto-reverses below 3) — no manual SQL | ⚠️VERIFY: trigger definition NOT in `supabase/migrations/0001–0026`, applied directly to live DB, uncaptured in VCS. GATE (app): `app/film/[slug]/page.tsx` sets noindex unless `figures>=3 && visible`; `sitemap.ts` filters `visible=true`. Data build separate from code deploy |
| 15 | Director generation layer | `worker/director-profile-{gen,batch,load}.py` → `director_portrait` + `director_next` (rec_name, target_slug, profile_path, reason); `worker/director-facts-{gen,load}.py` → `director_facts` (~30 web-grounded facts, "The Life"); `worker/director-picks-{gen,batch,load}.py` → `director_picks` ("Where to start"). Opus, Batch | PER-DIRECTOR (new directors only) | powers director page + home Surprise director cards | ⚠️ NOT auto-triggered today — new director without these → bare director page; Surprise director cards silently fall back to misreading |
| 16 | Director embedding refresh | ad-hoc SQL (no worker script) — avg of director's figure embeddings → `director_embedding` (slug, vector(1536), nfig, HNSW) | CORPUS-WIDE (null/new only) | powers director-map similarity ring + director-mode overview | ⚠️ needs Stage 4 first; skip → new director has empty similarity ring. BACKLOG: capture as `refresh_director_embeddings()` RPC + button |
| 17 | Geographic Locations (geocoding) | `worker/geo-extract.py` (LLM, threaded, DRY→`--apply`; reads `figures.kind='location'` + overview + takes) → `film_locations` (layer='setting', coords NULL, figure_id linked); `worker/geo-code.py --apply` (dedupe via `geo_cache`, Google Geocoding `GOOGLE_MAPS_KEY` 10k free/mo then $5/1k, or Nominatim). Buttons: `run-geo-extract-dry/apply.command`, `run-geo-code.command`. Per-film: `GEO_FILMS=<slug> run-geo-extract-apply.command` then geo-code | PER-FILM, additive | `film_locations`, `geo_cache` | NOTE: superseded operationally by the batch pipeline in `GEO_운영-신규영화-증분처리.md` (see §d). Vague/fictional places get no pin (intended). "Filmed" layer = future Phase 4 |
| 18 | Sentence layer (Embedding Fantasia) | SQL via MCP `execute_sql`; SSOT `HANDOFF-임베딩판타지아-문장층.md` §5; regen SQL `sentence-engine/MASS-PRODUCTION.md` | CORPUS-WIDE idempotent, cheap, LLM-0 | order matters: ① `sentence_node_stats` upsert → ② `sentence_concept_stats` upsert → ③ `film_kinship` upsert → ④ 13 pattern INSERTs (all `ON CONFLICT DO NOTHING`) | run after Stages 3–7 land (needs published takes, affinities, tropes; D/E/F/J patterns also refresh from lineage/ratings/locations). GATE: Fantasia module hides below 2 rows (graceful). ⚠️ title renames need per-pattern delete + re-insert (text drift). Heavy G/I self-joins corpus-wide need scratch-table + hex-bucket recipe; per-film increments trivial |

**Ordering constraints (hard):** 2 before 3; 4 before 5/6/7; bold-take/asset figure-creating loads before P3 embed; SEO (9) after any hub rename; 18 after 3–7; 16 after 4; per-film batches should be ONE combined Batch submission per stage across all new films (§6.E, not per film).

**Mandatory post-build backfills (§4 — "run every batch"):**
1. figure slug backfill — extract/import don't always fill `figures.slug`; verify `count(*) from figures where slug is null = 0` (missing → figures render as dead text).
2. film genres/overview/media — `run-tmdb-fetch-all.command`.
3. Connection engine refresh (after tropes/takes land; full recipe `HANDOFF-연결엔진-커넥션.md` = RUNBOOK "§4.3" referenced by STATE):
   a. `python3 worker/mt-recommend.py` (rebuilds `film_affinities`)
   b. counterpoint rebuild — 2 SQL blocks in `supabase/rpc/counterpoints.sql` header (conn_film_trope_vec → `entity_edges`)
   c. new raw concepts → `python3 worker/concept-embed.py` (report) → `--write 0.70`
   d. film_next backfill 1-liner: `update film_next fn set target_film_id=f.id from films f where fn.target_film_id is null and f.tmdb_id=fn.tmdb_id;` (new film became target of existing recs)
   e. galaxy coords `worker/galaxy-build.py` / `--directors` — ⚠️ quarterly at most; rebuild = ALL coordinates move. New director photos: `worker/director-profiles.py`.

**Verification checklist (§7):** figures slug null = 0; genres+overview populated; ≥3 figures reached (else noindexed, investigate); `takes.framework` + `figure_taxonomy` rows exist; `film_next`/`film_reception`/`film_asset` rows exist; no live hub/trope URL changed slug without `slug_history`/`merged_into`; Vercel build READY + spot-check pages; film appears in `/api/search` → `search_all` (immediate lexical; semantic once `takes.embedding`/`film_taste_vector` land); `/film/[slug]` connection map >1 node; new director has Stage-15 rows + `director_embedding` row; `/api/surprise/home` returns new-film cards; `film_asset`/`film_next` present so `why_watch`/`watch_next` don't always fall back to misreading.

## (b) Admitted automation gaps / manual steps (RUNBOOK §6 + BACKLOG §A/B)

- 🔴 **No single ingest wrapper.** Target `ingest-new.command <titles.csv>` chaining per-film Stages 1→2→3→10→11→12→13 in parallel batches, pausing only on the resolve-confidence review gate. Does not exist.
- 🔴 **Schema-in-VCS gap** (highest structural risk per STATE): `films.visible`/`is_analyzed`, the visible≥3-figures trigger, `map_*`, `surprise_home`, `director_embedding`+HNSW, catalog/trope/reception/watch-next/ask RPCs — live-DB-only. 240+ functions live; only `is_admin`/`handle_new_user` in `.sql` (as of 07-02; 0040/0041 search RPCs and later migrations 0043–0078 ARE committed — new-DB-work convention is to commit).
- 🔴 **Tradition match** (Stage 8) fully manual.
- 🟡 Corpus-wide additive mode: trope layer DONE (`trope-incremental.py`); PENDING: (a) new-trope FORMATION for unmatched takes (cluster→critic-gate→name) — deferred to garden pass; (b) `mt-consolidate.py --incremental` (LEGACY reading hubs, low pri); (c) scheduled monthly "garden" full-recluster — the only place renames are allowed, with redirects. Cadence unconfirmed (open question #1).
- 🟡 Resolve low-confidence review queue (silent drops today).
- 🟡 Backfill guards (figure slug, genres/overview) as automated assertions, not memory.
- 🟡 Redirect integrity check after renames: assert every retired slug has `slug_history`/`merged_into`.
- 🟡 Combined per-stage batches across all new films.
- 🟡 <3-figure alert at end of ingest (films silently noindexed otherwise — no alert today).
- 🟡 Per-film/per-framework SEO head-copy generator (hub `seo_phrase` exists; films lack own).
- 🟡 Auto director-generation trigger for new auteurs (Stage 15+16 manual today); `refresh_director_embeddings()` RPC missing.
- Stage 16 has no worker script at all (ad-hoc SQL).
- Stage 18 is manual SQL via MCP `execute_sql` (idempotent but unscripted as a worker).
- Watchlists Phase 3 (🟢): behavior-driven auto-promotion of heavily-tracked Tier-2 films to full analysis (film-extract) — needs trigger + badge. Directly relevant to the factory (Tier-2 → Tier-1 promotion path).

## (c) Auto-deploy watcher contract (FRONTEND-DISCOVERY §5 + memory)

- macOS watcher `auto-deploy-watch.sh`, run via **nohup from Terminal** (macOS TCC blocks LaunchAgent from ~/Documents; after reboot the owner re-runs the one-liner).
- **Stages ONLY `app components lib`**, auto-commits/pushes after ~20s of quiet → Vercel auto-build (~40s–2min).
- ⚠️ Root files (`middleware.ts`, `next.config`, `public/`, migration files, worker scripts, docs) need **manual commit** (memory: autodeploy-watcher-scope).
- ⚠️ Race hazards (memory: autodeploy-watcher-race): `.autodeploy-off` sentinel can be deleted by another session; watcher deletes others' `index.lock`; after a git timeout check `git log` before retrying. New CSS + page must land in ONE commit (watcher race — TakeScore Screener memory).
- Verification: Vercel API `get_deployment` READY + Chrome DOM checks. ⚠️ live-HTML audits right after deploy hit stale ISR cache — check code first + cache-buster (memory: live-audit-isr-cache-trap).
- DB changes go straight to live DB via Supabase `apply_migration` (instant) — decoupled from code deploy.

## (d) Geo incremental procedure for new films (GEO_운영-신규영화-증분처리.md, 2026-07-03)

Current operational path (Batch API + web_search supersedes Stage-17 single-film scripts for bulk):
- DB: `public.film_locations` (layer `'filmed'`/`'setting'`; source priority agent-search > agent-filmed > figure). Extraction: `worker/geo-batch-submit.py` (Anthropic Batch + web_search, model claude-sonnet-5, language-balanced prompt, film_id prevents same-title misattribution; dropped results go to `*.dropped.jsonl` only, never DB). Load: `worker/geo-batch-collect.py --wait --finish` → `worker/geo-load-results.py` (on_conflict dedupe, protected-DB isolation) → `worker/geo-code.py --apply` (Google geocoding, lat-null only, `geo_cache`). Cost audit: `worker/geo-batch-cost.py`. Language detect: `worker/geo-lang-list.py` (cached; only new films hit TMDB).
- **Incremental principle:** new films are in no `done*` checkpoint → auto-included in TODO; `films_lang.csv` is a cache, submit auto-fills new films.
- Procedure: ① `python3 worker/geo-batch-submit.py --seed-only --dry-run` — **cost gate: targets × $0.166/film; >$50 → report and wait for owner** ② `--seed-only --yes` → `geo-batch-collect.py --wait --finish` ③ `geo-batch-cost.py` + mandatory REST count verification (agent-search rows + null-coord count) — do not exit on failure ④ append one line to `HANDOFF-종합현황-지리촬영지.md` §12.
- ⚠️ `--seed-only` covers only `films.in_seed_catalog=true`; new films outside seed need full `--dry-run` cross-checked against recent `films.created_at` — **full-backlog submission FORBIDDEN** (not-done 1,468 + lang-unknown 3,390 ≈ $820, requires explicit owner approval).
- ⚠️ Rules: no manual DB INSERT/DELETE (only via `geo-load-results.py`); never delete/modify `geo-search/results*`/`done*` (append-only); never load `*.dropped.jsonl`; never re-submit before collect finishes (double-submission); failures absorbed by re-running the same submit after collect.
- **Post-processing (Locations SEO read layer):** film/director locations pages, country hubs, sitemap eligibility all auto (RPC + ISR 24h). Manual: (1) `python3 worker/atlas-cities-build.py` → regenerates `lib/atlas_cities.json` (watcher auto-deploys; a city page appears when a city reaches ≥3 films); (2) IndexNow batch ping `scripts/indexnow-ping.mjs`. Full invariants: `HANDOFF-아틀라스-SEO-읽는층.md` §2–3. ⚠️ City membership rules must stay in sync with the `atlas_*_json` RPC SQL (memory).

## (e) Lineage ingestion for a new film (handoff/10_master_ingestion_runbook.md)

Written for the one-time corpus load; the reusable per-film pieces:
- **`resolve_film()`:** ① `film_wikidata` → Wikidata `P4947` (TMDb movie ID) → `films.tmdb_id`; ② else TMDb `/find` by IMDb `P345` or TMDb search title+year; ③ match failure → create `films` stub (`visible=false`, `hold=true`, `in_seed_catalog=false`). `resolve_person()`: auteur QID → `P4985` → `directors.tmdb_person_id` (dedupe against existing rows).
- Order: schema (`02_schema.sql`) → lineage vocabulary (`seeds/lineage_lists.csv` 239 upsert ON CONFLICT(slug) + parent 2nd pass; `seeds/lineage_editions.csv` 24; auteur lines from `seeds/auteurs.csv` 160, facet=auteur) → `mappings/auteur_edges.csv` (53) → `mappings/film_auteur.csv` (407 → `film_lineage` facet=auteur) → award/canon membership from `mappings/film_lineage_ingestion_manifest.csv` (139) by method: **5a** `sparql_P166` (won; nominated via `P1411`) → resolve_film → `film_lineage(list_slug, edition_year, result, …)`; **5b** QID-less sub-awards (backfill QID or Wikipedia winner tables title+year); **5c** canon rankings (Wikidata list items e.g. S&S 2022 Q115577992, or published lists — TSPDT official xlsx, rank preserved, `edition_year=2026`); **5d** festival sections (`P1411` → `result=selected`, low weight, low priority).
- Derived values after membership: `selectivity` (IDF) + `film_count` recompute (`02_schema.sql §8`); `film_affinities` (shared_list_ids, lineage_score); **`film_scores`** per `07_scoring_model.md` — Prestige (decayed sum) / Discovery, result coefficients won 1.0 / runner-up 0.60 / nominated 0.45 / listed 0.45 / selected 0.30. Verification: `verify.sql` + manifest coverage + FK + (film,list,edition) dup checks.
- ⚠️ For a NEW film the incremental question (which lists it belongs to) is answered by re-running SPARQL per relevant list — no documented per-film incremental lineage script exists (UNKNOWN/VERIFY). ⚠️ memory: `compute_film_scores` requires lineage and does a **global delete — forbidden** as a casual per-film re-run (tier2-bare-digest memory). ⚠️ lineage matching is film-level; `edition_year≠film_year`; `film_count`-based gating forbidden (lineage-read-layer memory). Lineage feeds RUNBOOK Stage-18 pattern D and the Tier-2 Editor's digest.

## (f) Consolidated ⚠️ hazard list (from these docs)

1. Stage 2 before Stage 3, always (genre "Other" collapse / lost cast context).
2. Stage 4 (embed) before 5/6/7; figure-creating loads (bold-take/asset) before P3 embed.
3. `mt-consolidate` quality mode + `mt-recluster`/`mt-dedupe-rename`/`mt-retitle-splits` rename live hub slugs/titles and null `seo_phrase` — supervised only, DRY review + `merged_into`/`slug_history` redirects mandatory.
4. `trope-build --reset` wipes ALL trope hubs+members and recreates with new slugs; `trope-persist --apply` retires ~1,400 tropes / clears ~45k members; recovery only via local `_bak_trope_*`. Never run on a grown corpus as part of ingest — use `trope-incremental.py`.
5. Quality-mode reshaping deliberately EXCLUDED from `run-pipeline-auto/finish.command`.
6. `mt-seo-batch` must re-run after any hub rename.
7. Film with <3 extracted figures = silently noindexed, no alert.
8. `tmdb-resolve.py` low-confidence = silent drop; wrong director match corrupts entire downstream graph.
9. `films.visible` ≥3-figure trigger exists only in live DB (⚠️VERIFY — uncaptured).
10. Galaxy rebuild (`galaxy-build.py`) moves ALL coordinates — quarterly at most.
11. Geo: cost gate $50; no full-backlog submit (~$820) without owner approval; append-only checkpoints; never load `.dropped.jsonl`; no manual film_locations INSERT/DELETE; no submit before collect finishes.
12. Sentence layer: order stats→kinship→patterns; title renames require per-pattern delete+re-insert; brand contract (designer credit + Not-AI disclaimer removal forbidden); LLM-0 / random-0 invariants.
13. Watcher: only `app components lib`; root files manual; index.lock/`.autodeploy-off` races; new-CSS+page single commit.
14. Post-deploy live-HTML checks poisoned by ISR cache — code-first + cache-buster; `unstable_cache` null-poisoning (throw errors, don't cache null).
15. RUNBOOK internal staleness: Stage 13 "0 rows loaded" is stale (film_asset=1,957 live); §3b/FRONTEND §7 still say `/map`,`/atlas` (now `/network`,`/locations` — deliberate rename, keep `/api/map`, `atlas_*_json`, `atlas_cities.json`, `#df-atlas`).
16. Surprise empty-item gate must use `jsonb_typeof(r->'items')='null'`, not `IS NULL`.
17. EntityGraph node `<img>` needs inline `max-width:none` (globals.css `img{max-width:100%}` collapses absolutely-positioned node images).
18. `sm-` class prefix reuse across component families banned (past collision).
19. `films.id` uuid stays PK (decision: never re-key to tmdb_id); Tier-2 = `visible=false` rows.
20. PostgREST 1000-row cap on all REST/RPC responses — bulk reads need jsonb_agg single-row RPC pattern (memory).
21. `compute_film_scores` = lineage-dependent + global delete — do not run per-film.

## Gate/degradation map (per data dependency, from these docs)

| Surface | Reads | Gate | Missing-data behavior |
|---|---|---|---|
| `/film/[slug]` index/render | `films` | `figures>=3 && visible=true` for index; trigger auto-flips `visible` | noindex (page still renders); Tier-2 gets Editor's digest lead instead |
| sitemap/indexes | `sitemap.ts` filters | `visible=true` | excluded |
| Hub publish (LEGACY reading) | `mt-author.py` | ≥5 films per hub | stays unpublished candidate forever |
| Surprise cards `watch_next`/`recommended_by`/`why_watch`/`where_to_start`/`director_next` | `film_next`, `film_asset`, `director_picks`, `director_next` | rows exist for the drawn film | falls back to `misreading` (always available: film pool requires ≥1 SM) |
| Embedded EntityNetwork (`EntityMap`) | `/api/map` ego RPCs | payload >1 node | returns `null` — section hides gracefully |
| Director map similarity ring | `director_embedding` | row exists | ring empty; films still render |
| Fantasia module | `film_sentences` | ≥2 rows | module hides gracefully |
| Locations city page | `lib/atlas_cities.json` | city ≥3 films (rebuilt by `atlas-cities-build.py`) | no page until rebuild |
| Unified search lexical | `search_all` | automatic on insert | semantic leg absent until `takes.embedding`/`film_taste_vector` land |
| Engine Room desk routes `/film/[slug]/{theories,…}` | `essays` | published essay exists | `notFound()` |

## LEGACY markers

- **`RUNBOOK-metatake.md` = LEGACY in toto** — the original 2026-06 meta-take/register build (`0013_metatake.sql`, `worker/run-mt-build.command`, `mt-import.py`, mt-clean, `/meta-takes`, `/take/[slug]` verification steps, Gemini authoring). The meta-take/reading-hub/register model is retired; `meta_takes.kind='reading'` survives only as unpublished candidates — do not surface. Still-live descendants of that toolchain: `mt-embed.py`, `mt-consolidate.py` (fragile, legacy-hub-facing), `mt-author.py`/`mt-rank.py` (legacy-hub-facing), `mt-recommend.py` (REWRITTEN 2026-07-04, live-critical), `mt-seo-batch.py` (trope hubs). §2.5 backfills (figure slug, `run-tmdb-fetch-all.command`) remain live practice (mirrored in RUNBOOK §4).
- Legacy routes still mounted: `/meta-takes`, `/take/[slug]`, `/frames`, `/frame/[slug]` (STATE §3). `/take` marked obsolete in sentence-layer closing ledger (memory).

## RUNBOOK-EngineRoom.md — new-film-relevant notes only

Separate essay-generation pipeline (9 desk corners) over visible & is_analyzed films: tables `corner_assignments`, `essays`, `essay_registry`; per-film assignment via Sonnet-5 Batch (dossier SQL: figures ≤8 + take titles ≤6 + reception + top-5 tropes); model routing per corner; desk routes `/film/[slug]/{theories|debates|contested|reception-story|parallel-lives|field-test|decoder|exegesis|accuracy}` gated on published essay else `notFound()`; SEO cohort `INDEX_COHORT_ESSAYS` in `lib/seo.ts`. **Status (memory): generation FULLY FROZEN — wave-4 drafts 1,998 local pending; essays canonical surface moved to `/film/[slug]/[desk]` + `/curious` index.** For the factory: a new film gets NO desk essays automatically; Engine Room is a frozen, owner-gated content stream, not part of ingest. Prohibitions: no direct writes to prod DB (branch→merge), no AVAULT access, no essay prose edits, no theory-candidate pre-injection (verification does lookup only), no experiment framing in title/meta, cost guard $1.2/essay & $3,000 total. ⚠️ kyniq branch replay is broken from migration 0016 (memory: films stub → new migration → merge workaround).

**Doc staleness caveat for the caller:** RUNBOOK-new-film-ingestion.md predates (2026-06-24) major live layers that a new film now also needs and that are NOT in its 18 stages: TakeScore/`cinecodex.scores` (LLM sonnet scoring, paid), `film_scores` (정전가), `film_taste_vector`, `film_ratings`/`film_watch_providers` + `film_provider_index` (Screener), lineage membership, movements, TV broadcast layer (`tv_*`), i18n `content_i18n` reconciler, Now Playing/hourly, misreadings articles eligibility (`misreadingsEligibleSlugs()`), tow_comment curation. Those live in their respective HANDOFF docs, outside the Task-A source set.