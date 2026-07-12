# TASK F — WORKER CENSUS (film importer factory recon)

Scope scanned: `worker/*.py` (110 py files; the rest of worker/'s 792 entries are JSONL artifacts/logs/batchids), `worker/*.command` (~84), root `*.command` (~230, mostly deploy), `scripts/`, `magazine research agent/`, `hourly/`, `Outputs/figure_seo/`, `curation-handover/02-phase0/`, `worker/tier2-backfill/`, `worker/src/`. Stage numbers = `docs/RUNBOOK-new-film-ingestion.md` (§3, verified current, last reconstructed 2026-06-24).

Universal conventions (apply unless noted): env auto-loaded from repo-root `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for all DB writers); DRY by default; Batch API scripts follow `emit → submit → fetch → load` with resume via `.jsonl`/`.batchids.txt`/`.submitted.txt` skip-lists.

---

## 0. ORCHESTRATORS / WAIT

| Script | Purpose | Notes |
|---|---|---|
| `worker/run-pipeline-auto.command` | Unattended P0-wait → P3 `mt-embed.py` → P4 `mt-consolidate.py --persist` → P5a `mt-author.py` → P5b `mt-rank.py` → P5c `mt-recommend.py`. Stops on first failure; every step idempotent; log `worker/pipeline-auto.log`. ⚠️ Deliberately stops before P6/P8/P9 (destructive/supervised). |
| `worker/run-pipeline-finish.command` | P0-wait (tropetag) → **P6b `trope-build.py --persist --reset`** ⚠️DANGEROUS (see §7) → P8 `mt-seo-batch.py --submit` then polls `--fetch` ×12 @120s. Stops before P9 (integrity + un-hold + deploy = supervised). Log `worker/pipeline-finish.log`. |
| `worker/pipeline-wait-batch.py` | Blocks until newest `figures` AND `takes` rows are >QUIET secs old (poll 30s). Guards timing only, not correctness. Pure read. |
| `worker/pipeline-wait-tropetag.py` | Blocks until `figure_tags` rowcount stops growing (3×60s quiet polls). Pure read. |
| `check-batches.command` (root) | Read-only status of catalog batches saved in `Element/*.batch`. Needs `ANTHROPIC_API_KEY`. |
| `unlock-git.command`, `auto-deploy-watch.sh` (root) | Deploy plumbing: watcher auto-commits only `app/ components/ lib/`; pause file `.autodeploy-off`. ⚠️ root files (middleware, next.config, `public/`) need manual commit; watcher deletes others' `index.lock` (race hazard, see memory). |
| `deploy-*.command` (~200 root files) | All identical shape: `git add/commit/push` → Vercel auto-build. Not pipeline logic; per-feature historical launchers. `redeploy.command`, `nudge-deploy.command` generic. |

---

## 1. RESOLVE (Stage 1)

**`worker/tmdb-resolve.py`** (`worker/run-tmdb-resolve*.command`, `run-tmdb-resolve-1000[-persist].command`)
Title+director → `tmdb_id` via TMDB `/search/movie` + `/movie/{id}/credits` director disambiguation; dedup vs existing `films.tmdb_id` + normalized title; writes resolved CSV then upserts `films(tmdb_id,title,year,director,director_slug,slug)` (slug=`slugify(title)-year`, collision-avoided). No LLM. Idempotent: upsert-by-tmdb_id, ignore-duplicates; rows already having tmdb_id in CSV are trusted, not re-searched. Flags: `--persist`, `--include-low`. Env: `TMDB_READ_TOKEN`, SUPABASE pair. ⚠️ high/medium confidence only by default; low/unmatched printed for manual eyeball — **wrong director match attaches the whole downstream graph to the wrong film**. Stage 1, manual gate.

## 2. FETCH / EXTERNAL DATA (Stages 2, backfills §4, Tier-2 enrichment)

| Script | Purpose / writes | Model | Idempotency | Flags | Env | Stage |
|---|---|---|---|---|---|---|
| `worker/tmdb-fetch.py` (`run-tmdb-fetch-{new,all}.command`, poster-backfill variants) | TMDB `/movie+credits+release_dates+videos+images` → UPDATE `films`(overview,genres,backdrop_path,tagline,runtime,release_date,certification,poster_path,tmdb_extra=curated cast) + `media` rows (backdrops, official trailer) + `directors`(profile,bio) | none | idempotent: deletes entity's prior tmdb/youtube media then re-inserts; upserts films/directors | `--film <slug>` (repeatable), `--persist` | `TMDB_READ_TOKEN`, SUPABASE | **Stage 2 — MUST precede Stage 3** (else genre "Other" collapse) |
| `worker/external-data.py` (`worker/run-external-data{,-dry,-backdrops}.command`) | Per tmdb_id: TMDB external_ids+watch/providers → `films.imdb_id` backfill + `film_watch_providers(results jsonb,countries[])`; OMDb → `film_ratings(imdb_rating,imdb_votes,metascore,rt_tomatometer)` | none | resumable: skips films already having providers/ratings row unless `--refresh` | `--persist --scope all\|visible --refresh --limit N --backdrops` | `TMDB_READ_TOKEN`, `OMDB_API_KEY`, SUPABASE | POST-RUNBOOK backfill (memory: Tier-2 imdb_id cohort). ⚠️ `--shard` flag from memory NOT found in code — VERIFY (parallelize via `--limit`/manual split) |
| `worker/tier2-backfill/backfill.mjs` | TMDB fill-only for `films.visible=false`: original_title/overview/genres/runtime/release_date/tagline, **only when null** | none | null-only fill; never alters schema | `--dry-run --limit` | SUPABASE, `TMDB_READ_TOKEN` | POST-RUNBOOK (Tier-2 free enrichment) |
| `worker/release-events.py` | TMDB release_dates → `film_release_events` (cohort: visible ∪ has film_reception) | none | per-film delete+bulk insert (멱등) | `--dry --limit` | TMDB, SUPABASE | Stage 11-adjacent (Afterlife layer), POST-RUNBOOK |
| `worker/wd-honors.py` | Wikidata SPARQL P166/P1411 by imdb_id → `film_wd_honors` | none | per-film delete+insert | `--dry --limit` | SUPABASE only (Wikidata free) | POST-RUNBOOK (reception/afterlife) |
| `worker/wikidata-id.py` | imdb_id → `films.wikidata_id` (P345 SPARQL, 150/query) | none | PATCH only null wikidata_id | `--dry --limit` | SUPABASE | POST-RUNBOOK (feeds JSON-LD sameAs + ko-aliases) |
| `worker/ko-aliases.py` | Wikidata ko labels/altLabels (films via wikidata_id; directors via tmdb_person_id P4985) → `search_aliases` | none | unique(kind,slug,alias) upsert-ignore | `--dry --limit` | SUPABASE | POST-RUNBOOK (i18n/search v4) |
| `worker/film-clips.py` (`run-film-clips{,-dry}.command` root, `worker/film-clips-daily.sh` launchd/nohup daily `--persist --limit 70`) | YouTube Data API scene/clip search (drops trailers/reactions/spoilers) → `media(kind='video',source='youtube',meta.type='clip')` | none | skips films already having ≥`--max` clips | `--persist --limit --max` | `YOUTUBE_API_KEY`, SUPABASE | POST-RUNBOOK (film hero reel) |
| `worker/crew-index-build.py` | TMDB credits for all visible films → `lib/crew_index.json` (people ≥3 catalog credits; gates `/credits/[slug]`) | none | full deterministic rebuild of a static file | none | `TMDB_READ_TOKEN` | POST-RUNBOOK; rerun after catalog expansion; watcher deploys lib/ |
| `worker/director-profiles.py` | TMDB person search → `director_profile`(slug,tmdb_person_id,profile_path,method) for galaxy directors | none | idempotent upsert; `--force` re-fetch | `--force` | `TMDB_READ_TOKEN` | RUNBOOK §4.e (new director photos) |
| `worker/access-enrich-build.py` | Regenerates `data/access_enrichment.json` from seed + `세계 영화/access_db/batches/*.jsonl` (where-to-watch verdicts) | none | deterministic, byte-identical | `--write` | none (file-only) | POST-RUNBOOK (access layer) |

## 3. EXTRACT / FILM CONTENT (Stage 3)

| Script | Detail |
|---|---|
| `worker/film-extract.py` (`run-film-extract*.command`) | Sync sibling of the batch: for films with **zero figures**, ONE Opus call invents 6–8 figures + 3 register-distinct takes each. Writes `figures`, `takes` (status=published). Model `claude-opus-4-8`. DRY default; `--persist`; ⚠️ `--reset` deletes named films' AI figures (cascades takes) and **requires explicit `--film` slugs** (safety). Env: ANTHROPIC, SUPABASE, TMDB context. |
| `worker/film-extract-batch.py` (`run-film-extract-batch{-submit,-fetch}.command`) | Same prompt via **Batch API** (Opus, ~50% off). `--submit` (one request per figure-less film; batch id → `worker/film-extract-batch.json`), `--fetch` (poll+persist). Idempotent: films with figures skipped. **Stage 3 canonical path.** |
| `worker/bold-take-gen.py` → `worker/bold-take-batch.py` → `worker/boldtake-load.py` (`worker/run-bold-take-*.command`, `run-boldtake-load-{dry,apply}.command`) | Strong Misreadings v13.3: per film ONE spoiler-free INVITATION + bold takes across the 14 frameworks with theorist/concept metadata. gen: Opus `claude-opus-4-8`, `--emit-requests --all` (RPC `bold_take_films`), resumable, `--limit/--offset/--max-cost`; batch: submit/fetch `--out bold-take-full --chunk 1000`; load: writes `takes(framework,is_invitation,theorist,concept)`, creates new `figures` with **worker-assigned UUIDs** (deterministic plan `boldtake-load-plan.json`, DRY default). ⚠️ Ordering invariant: bold-take load MUST land **before** P3 embed so new figures get embedded/clustered. Stage 3. |
| `worker/figure-enrich.py` (`worker/run-figure-enrich*.command`) | Adds ≥3 register-distinct takes to films that ALREADY have figures (one call per film, cross-figure spread); fills `figures.slug` + seed-take register. Default model list `gemini-3.1-pro-preview,gemini-3.1-pro` (override `--model claude-opus-4-8`). Flags `--persist --limit --film --film-like --out`. **Mostly LEGACY** (seed-era register model; new films go through film-extract), but is the origin of the `figures.slug` backfill obligation (RUNBOOK §4.1). |
| `worker/film-features.py` (`worker/run-film-features.command`) | 4 fixed hub sections per film: pitch/record/reception/experience → upsert `film_features(film_id,kind)` + sync `films.aesthetic_level`. **Model: Gemini** (`gemini-3.5-flash` → `gemini-2.5-flash` fallback; `GEMINI_API_KEY`). Skips films with all 4 sections; `--force` regenerates; `--limit --film --dry`. Stage 11 (reception essay leg). |
| `worker/spoiler-backfill.py` (`worker/run-spoiler-backfill.command`) | Re-grades published `questions` spoiler_level/title_spoiler/display_title/safe_hook + `canonical_answers.spoiler_level`. `--limit --dry --force`. Question layer (Curious); POST-RUNBOOK. |

## 4. EMBED (Stage 4)

| Script | Detail |
|---|---|
| `worker/mt-embed.py` (`run-sm-embed.command`, `run-mt-embed.command`) | Fills `takes.embedding` (rationale), `figures.embedding` (description), `meta_takes.embedding` (title+thesis basis). OpenAI `text-embedding-3-small` 1536-d. Writeback via `bulk_set_embeddings` RPC (~100 rows/call). Null-only unless `--force` (meta_take always re-embedded for consistent dedup basis). Flags `--dry --force --only take,figure,meta_take`. Env: `OPENAI_API_KEY` + SUPABASE. **Stage 4 — must precede 5/6/7.** |
| `worker/concept-embed.py` | Maps free-text `takes.concept` variants → `sm_concepts` → materialises `concept_map` (exact + cosine ≥ threshold). Cache `worker/.concept_embed_cache.json`. Report-only default; `--write 0.70`. RUNBOOK §4.3c. |
| `worker/essay-embed.py` | Embeds verified EN desk essays → `essays.embedding` (migration 0056; semantic search leg). Null-only, batches 48. `--dry --limit`. POST-RUNBOOK (Engine Room). |
| `worker/theory-canon-embed.py` (`run-theory-canon-embed{,-dry}.command`) | Fills `theory_canon.embedding` (basis "title — theorist. category") via `bulk_set_canon_embeddings` RPC. Null-only unless `--force`. Stage 8 support. |

## 5. CONSOLIDATE (Stage 5) — ⚠️ CORPUS-WIDE FRAGILE

| Script | Detail |
|---|---|
| `worker/mt-consolidate.py` + `worker/mt_consolidate_core.py` (`run-mt-consolidate{,-dry}.command`) | DEDUP hubs via `hub_dup_pairs(THRESH)` cosine ≥0.86 union-find (re-links `takes.meta_take_id`, deletes merged hubs), GATE report (<5 films = unauthored candidates, no delete), SPLIT >70-figure hubs (recursive 2-means; new candidate child hubs, sibling edges). DRY default; `--persist --cap 70 --thresh 0.86 --gate 5`. ⚠️ generates new hub slugs + re-links takes across whole corpus; URL integrity depends on `merged_into` + `slug_history`. Stage 5 / P4 (included in run-pipeline-auto). |
| `worker/mt-recluster.py` (`run-recluster{,-dry}.command`) | **DANGEROUS quality mode.** LLM-grounded (Opus) merge of same-name/near hubs + k-means split of >70-take hubs; losers `merged_into`+status='retired' (301). Renames live hub titles/slugs, **nulls `seo_phrase`**. `--persist --model --samples --simdist 0.08 --maxtakes 70`. Supervised only; excluded from orchestrators. |
| `worker/mt-dedupe-rename.py` | **DANGEROUS quality mode.** Fixes duplicate-NAMED hubs by LLM per-group naming (Opus); merges same-named members. `--persist --model --samples 6`. Renames live entities. |
| `worker/mt-retitle-splits.py` (`run-mt-retitle{,-dry}.command`) | **DANGEROUS-lite.** Distinct titles/laconics (+`--essays` rewrite) for split siblings; new slugs generated. Nothing moved/deleted; naturally idempotent. `--persist --essays --limit`. |
| `worker/mt-import.py` | LEGACY seed loader (567-film CSV → films/theory_families/theorists/figures/takes). Aborts if takes present; `--force` override, ⚠️ `--fresh` deletes figures/takes/meta_takes first. LEGACY. |
| `worker/mt-clean.py` | LEGACY seed prose cleanup ("Target Object" template strip). Idempotent (template-marker-only unless `--force`). LEGACY. |

## 6. AUTHOR / RANK / RECOMMEND (Stage 6, P5a-c)

| Script | Detail |
|---|---|
| `worker/mt-author.py` | For each candidate hub ≥5 films: Opus writes title/laconic/thesis/250-400w essay with deterministic `{{film:uuid}}` linkification; sets status='published' (publish-then-audit). Null-only unless `--force`; `--limit --dry`. ⚠️ hubs never reaching 5 films stay unpublished forever (gate). |
| `worker/mt-rank.py` | Embeds take rationales vs hub embedding → `meta_take_rankings(rel_rank,surp_rank)`. OpenAI embeddings, re-runnable. `--limit --dry`. |
| `worker/mt-recommend.py` + `mt_recommend_core.py` (`run-rank-recommend.command`) | 2026-07-04 rewrite: drives chunked SQL RPCs `conn_rebuild_stage_truncate` → `conn_stage_tfidf_chunk*` → `conn_stage_knn_chunk*` → `conn_affinities_swap` (atomic swap) → `film_affinities` (RRF of trope TF-IDF + `film_taste_vector` cosine, top-24/film). Drives /movies-like, film Connected, /network 'like' edges. ⚠️ invariants in `HANDOFF-연결엔진-커넥션.md` (no meta_take_id regression). No LLM. Re-run after every ingest (RUNBOOK §4.3a). |
| `worker/galaxy-build.py` | **DANGEROUS (full rebuild = all coordinates move).** t-SNE (seed 42) + KMeans: `film_taste_vector`→`film_map_xy` (k=14); `--directors`: `director_embedding`→`director_map_xy` (k=10); `--labels` refresh only. Needs scikit-learn. RUNBOOK §4.e: run ~quarterly only. |

## 7. TROPE (Stage 7, P6) — ⚠️ FRAGILE

| Script | Detail |
|---|---|
| `worker/trope-tag.py` (`run-trope-tag*.command`) | Stage-1: 1 Opus call/film assigns ≤3 film-agnostic type tags per figure → `figure_tags`. Idempotent (untagged figures only). `--persist --limit --model`. |
| `worker/trope-build.py` (`run-trope-build{,-dry}.command`) | **DANGEROUS.** Stage-2: embed distinct tags (OpenAI) → union-find clusters ≥GATE films → Opus-named trope hubs → `meta_takes(kind=figure_type)` + `figure_type_members`. `--persist --thresh 0.60 --gate 5 --model`; ⚠️ **`--reset` wipes ALL trope hubs+members and recreates with NEW slugs** (breaks live URLs) — and run-pipeline-finish.command runs it with `--reset`. |
| `worker/trope-incremental.py` (`run-trope-incremental-dry.command` root) | **The safe additive path (RUNBOOK §6.B, DONE).** New takes (published, non-invitation, `trope_id IS NULL`) → nearest published trope by cosine via RPC `trope_match_takes`; assigns `takes.trope_id` + `figure_type_members` via RPCs `trope_set_take_tropeid` / `trope_insert_members` when sim ≥ `--thresh` (default 0.72). Never deletes/renames/re-slugs. DRY default (histogram); `--films slug,slug` or `--all-null`; `--persist`. **This is the importer-factory trope stage.** |
| `worker/trope-form.py` (`run-trope-form-{cluster,sweep}.command`, `run-trope-harmonize.command`) | Quality re-formation stage `cluster` (numpy leader-clustering of take embeddings → `trope-clusters.json`, no LLM/no writes). Flags `--model claude-opus-4-8 --pilot --bigsplit`. Supervised. |
| `worker/trope-gate-batch.py` (`run-trope-gate-*.command`) | Batch API critic-gate+naming calls (submit/fetch, resumable via `.submitted.txt`/results). Feeds `trope-form.py finalize` (≥2 films & ≥2 members). |
| `worker/trope-consolidate.py` / `worker/trope-consolidate-apply.py` (`run-trope-consolidate-{dry,apply}.command`) | **DANGEROUS.** Folds reading hubs into trope layer + dedups (Opus; `--persist`, thresholds `--auto-merge 0.86 --auto-new 0.70 --trope-dup 0.90`). Apply script replays REVIEWED `trope-consolidate-dry.json` via RPCs only, no re-LLM; reversible via `_bak_consol_meta_takes`/`_bak_consol_ftm`; aborts if already applied. |
| `worker/trope-persist.py` (`run-trope-persist-{dry,apply}.command`) | **DANGEROUS.** Applies `trope-plan-harmonized.json`: retires old figure_type tropes + clears members (~1,400 retired / ~45k members cleared historically) → inserts new tropes + `takes.trope_id` + members + `meta_take_edges`. `--apply`; preflight aborts if applied/snapshot missing; reversible only via local `_bak_trope_*` snapshots. |

## 8. SEO

| Script | Detail |
|---|---|
| `worker/mt-seo-batch.py` (`run-mt-seo-{submit,fetch}.command`) | Haiku (`claude-haiku-4-5-20251001`) Batch: plain-language search phrase per published reading/trope hub → `meta_takes.seo_phrase` (null-only). `--submit/--fetch`. ⚠️ must re-run after any hub rename (recluster nulls seo_phrase). Stage 9/P8. |
| `Outputs/figure_seo/{fetch_input,batch_submit,batch_poll,pilot_run,qa_and_write}.py` + `gen_common.py` (RUNBOOK: `Outputs/figure_seo/RUNBOOK.md`) | Figure-page question-subtitle metadata, 18,168 figures, Opus `claude-opus-4-8` Batch (cost guard $80, uses `anthropic` SDK + `requests` — the only pip-dependent toolkit). `qa_and_write.py qa|retry|write|verify` — write = per-row PATCH, new columns only (entity-invariant principle per memory). POST-RUNBOOK. |
| `scripts/indexnow-ping.mjs` | IndexNow ping: `node scripts/indexnow-ping.mjs <url…>` or `--sitemap`, `--dry-run`. POST-deploy distribution. |
| `worker/gsc-pull.py` + `worker/gsc-daily-watch.sh` | GSC Search Analytics → `mt_gsc_daily(day,page,query,clicks,impressions,ctr,position)`. Auth: service-account JWT signed by shelling to `openssl` (key `worker/gsc-sa.json`, gitignored; env `GSC_SA_JSON`, `GSC_PROPERTY`). `--persist --days N` (default 3-day window). Watcher = nohup loop (launchd/cron TCC-blocked in ~/Documents; **must be restarted after reboot**). Feeds intent-coverage program. |

## 9. CATALOG / ARCHETYPE (Stage 10)

`worker/catalog-load.py` (one-time: `Element/*.xlsx` → `taxonomy_nodes` + embeddings) → `worker/catalog-map-run.py` (`--kind object|location`, Sonnet `claude-sonnet-4-6` Batch, kNN candidates via RPC `catalog_candidates`, batch id resumable in `Element/catalog-map-<kind>.batch`; `--limit --no-write --fresh --poll-secs`) + `worker/catalog-map-char.py` (characters multi-label via RPC `catalog_char_candidates`; `--dry --sync --cancel --workers 8 --n --limit --no-write --fresh`) → writes `figure_taxonomy(axis=node kind, confidence)` with abstention/validation (no hallucinated labels). `worker/catalog-map.py` = DRY cost-comparison pilot (Haiku vs Sonnet, never writes). Launchers: root `run-catalog-*.command`.

## 10. RECEPTION (Stage 11)

All in `magazine research agent/` (note: path contains a space).

| Script | Detail |
|---|---|
| `reception-discover.py` | Discovery per film: OpenAlex (academic, false-positive gates) + Brave Web Search (`BRAVE_API_KEY`, allowlist domains, 1/outlet) + Wikipedia fallback; extraction ladder from `comment_extractor.py` (dek/og:description/JSON-LD/abstract → ≤10-word verbatim verdict). LLM 0, copyright-safe by construction (verbatim-substring only, no body storage, robots respected). |
| `reception-run.py` (root `run-reception-all.command`, `run-reception-pilot/smoke/fill-academic.command`) | Production: film list from Supabase, ThreadPool + Brave global throttle (1 req/s free tier), resume via `reception_data/<slug>.json` (skip existing) → `reception-all.jsonl` + summary. `--limit --workers 6 --acad-cap 8 --crit-cap 10`. |
| `reception-load.py` (root `run-reception-load.command`) | `reception-all.jsonl` → `film_reception`, per-film delete+insert (멱등). `--dry`. |
| `comment_extractor.py` | Library (the verified extraction ladder). |
| `dek-refresh.py` | Re-extracts criticism `dek_lead` at 520-char cap; rebuilds reception-all.jsonl. `--limit --workers 3`. |
| `openalex-chain.sh` / `openalex-full.sh` | Batch OpenAlex crawls with lock/done files. ⚠️ OpenAlex 429 trap (memory). |
| `worker/magazine-ingest.py` (root `run-magazine-ingest{,-dry}.command`, `run-magazine-recrawl.command`) | Allowlisted outlet RSS → SHORT snippets + `text-embedding-3-small` embeddings for RAG (/search·/ask retrieval). Fair-use caps baked in (only `active=true AND ingest_method='rss'` outlets; first ~SNIPPET_WORDS; article_url kept). Writes UNKNOWN table (likely `magazine_snippets` — VERIFY). |

Gate note: `/film/x/reception` renders from `film_reception` + `film_release_events` + `film_wd_honors` + TMDB; page opened to Tier-2 (memory: tier2-free-enrichment). Missing data → section hides.

## 11. NEXT / WATCH-NEXT (Stage 12)

Chain (root `run-next-{dry,submit,fetch,resolve,load}.command`): `worker/next-gen.py` (Sonnet `claude-sonnet-4-6`; DRY pilot or `--emit-requests --all --out next-all`, skips slugs already in `next-all.jsonl`) → `worker/next-batch.py submit|fetch --out next-all --chunk 1000` (Batch) → `worker/next-resolve.py` (DB match norm-title+year±1+director → TMDB verify → **drop hallucinations**; re-runnable — non-DB recs link up as corpus grows; `--dry`) → `worker/next-load.py` (`next-all.resolved.jsonl` → `film_next`, per-source-film replace, idempotent). Reverse surface = RPC `film_next_reverse`. ⚠️ post-ingest backfill (RUNBOOK §4.3d): one-line SQL `update film_next set target_film_id=… where target_film_id is null and tmdb_id matches` when a NEW film becomes an existing rec's target.

## 12. ASSET / WHY-WATCH (Stage 13)

`worker/asset-gen.py` (Opus `claude-opus-4-8` + prompt caching; spoiler-free 8-lens dossier grounded in DB/TMDB facts; `--films`, `--emit-requests --all --out asset-all`, `--model`) → `worker/asset-batch.py submit|fetch --out asset-all --chunk 1000` (Batch, priced Opus 15/75) → `worker/asset-load.py` (`asset-all.jsonl` → `film_asset` upsert by film_id, HTML-cleaned, `--dry`). Launchers: root `run-asset-{dry,submit,fetch,load}.command`. Lens keys: auteur_vision, aesthetic_innovation, technical_mastery, philosophical_inquiry, cinematic_lineage, spatial_aesthetics, critical_reception, context_discourse. Feeds Surprise `why_watch` (falls back to misreading when absent).

## 13. DIRECTOR (Stage 15) — trigger only for NEW directors

Three gen→(batch)→load triples, all Opus `claude-opus-4-8`, all load-DRY-default with `--apply`, root `run-director-*.command` launchers:
- **Profile**: `director-profile-gen.py` (`--emit-requests --all --min-films 3`) → `director-profile-batch.py submit|fetch` → `director-profile-load.py --apply` → `director_portrait`(body,source='ai') + `director_next`(pos,rec_name,reason,target_slug,tmdb_person_id,profile_path). Re-runnable: unmatched recs link up later.
- **Picks** ("Where to start"): `director-picks-gen.py`/`-batch.py`/`-load.py --apply` → `director_picks` (validates pick slugs against VISIBLE filmography; replaces rows per director).
- **Facts** ("The Life"): `director-facts-gen.py` — Opus free-writes ~30 facts, then **Brave verification** per fact (EN + native language) with Sonnet `claude-sonnet-4-6` judge; requires `BRAVE_API_KEY` (hard exit without). Sync (not Batch). `--gen-fallback --judge-model`. → `director-facts-load.py --apply` → `director_facts`.
⚠️ Not auto-triggered today (RUNBOOK Stage 15 risk): new director without these = bare director page + Surprise cards silently fall back. Stage 16 (director_embedding avg refresh) has **NO worker script — SQL-only, BACKLOG `refresh_director_embeddings()` RPC**; skipping = empty similarity ring.

## 14. GEO / LOCATIONS (Stage 17) — additive, per-film

| Script | Detail |
|---|---|
| `worker/geo-extract.py` (`worker/run-geo-extract-{dry,apply}.command`) | Setting-layer: LLM (default `claude-haiku-4-5`, env `GEO_MODEL`, `GEO_WORKERS=6`) reads `figures.kind='location'`+overview+takes → real mappable places → `film_locations(layer='setting', coords NULL, figure_id)`. Per-film via `GEO_FILMS=<slug>` env. Threaded, DRY default, `--apply`, idempotent. |
| `worker/geo-extract-search.py` | Drop-in v2: **Tavily web search** (`TAVILY_API_KEY`) + `claude-sonnet-4-6` → filming locations with addresses, multi-source tiering. ⚠️ legal rule: single-source from protected DBs (movie-locations.com/atlasofwonders) = quarantined, not written. |
| `worker/geo-batch-submit.py` / `geo-batch-collect.py` / `geo-batch-cost.py` | V2 language-balanced Batch pipeline (`claude-sonnet-5`, env `GEO_BATCH_MODEL`): submit `--dry-run --pilot N --yes --only <cats> --seed-only`; collect `--wait --finish` (auto-chains geo-load-results + geo-code --apply); cost reconciler. State: `batches.v2.json`, `geo-search/results.v2.jsonl`. |
| `worker/geo-load-results.py`, `geo-dump-films.py`, `geo-lang-list.py` | Loader (results.jsonl → `film_locations`, coords null) + corpus dumps (`geo-search/films_master.csv`, `films_lang.csv`). |
| `worker/geo-code.py` (`worker/run-geo-code.command`) | Stage 2: dedupe distinct names through `geo_cache` (each name geocoded ONCE → re-runs ~free) → Google Geocoding (`GOOGLE_MAPS_KEY`, 10k free/mo) else Nominatim (1 req/s, forced GEO_WORKERS=1) → lat/lng/precision/country onto `film_locations`. `--apply`. |
| `worker/atlas-cities-build.py` | Rebuilds `lib/atlas_cities.json` (frozen city/region roster; RPC `atlas_city_candidates_json`; ≥3 visible films, p90 spread ≤150km, MERGE_KM=50, CAP=1000). Append-friendly (stable slugs). ⚠️ city membership rules must stay in sync with the `atlas_*_json` RPC SQL. (Names deliberately kept post Atlas→Locations rename.) |

## 15. LINEAGE

`worker/lineage-ingest.py` (root `run-lineage-ingest{,-dry}.command`): CSV package → `lineage_lists` (ON CONFLICT slug), editions, `film_lineage` memberships to EXISTING films only; recomputes `lineage_lists.film_count` + selectivity IDF. DRY default. `worker/lineage-resolve.py` (root `run-lineage-resolve*.command`): Phase 2 — resolves rest of universe via TMDB (cache `worker/lineage-tmdb-cache.json`), attaches to existing films or **creates STUB films (`visible=false, hold=true, is_analyzed=false, in_seed_catalog=false`)**; adds only, never touches Phase-1 rows. ⚠️ gate rule from memory: never gate lineage pages on `film_count`.

## 16. THEORY (Stage 8 — partially manual)

`worker/theory-import.py` (`run-theory-import.command`): `worker/theory_canon.csv` → `theory_canon`; ⚠️ **clears table first** (idempotent-by-truncate); prints "tell Claude to run tradition backfill" — **tradition match is NOT automated (RUNBOOK GAP)**. `worker/theory-prep.py` (read-only preprocessing → `worker/theory-artifacts/*.jsonl` + review-queue.md) → `worker/theory-load.py [--dry]` (loads `theory_concepts` 8,196 / `theorist_concepts` 8,876 / `concept_aliases` / `theory_canon_map` / canon unified taxonomy, explicit ids). `worker/theory-cleanup.py [--dry]` (deterministic: splits composite theorist rows, backfills `theory_concepts.sm_concept_id`, emits `crosswalk-review.csv`). `worker/theory-canon-embed.py` (§4 above).

## 17. SENTENCE LAYER (Stage 18)

**No Python worker.** Rule-based SQL run via MCP `execute_sql`: order ① `sentence_node_stats` upsert ② `sentence_concept_stats` ③ `film_kinship` ④ 13 pattern INSERTs into `film_sentences` — all `ON CONFLICT DO NOTHING` (purely additive per new film). Recipes: `sentence-engine/MASS-PRODUCTION.md` (scratch-table + hex-bucket for corpus-wide G/I self-joins); canonical doc root `HANDOFF-임베딩판타지아-문장층.md`. Invariants: LLM 0, random 0, brand disclaimer preservation. Gate: Fantasia module hides below 2 rows (graceful). ⚠️ Title renames need per-pattern delete+re-insert.

## 18. ENGINE ROOM / ESSAYS (desk essays; generation currently FROZEN per memory)

- `worker/assignment-desk-dossier.py` (build per-film dossiers → `assignment-desk.dossiers.jsonl`) → `assignment-desk-batch.py emit|submit|fetch` (`claude-sonnet-5` Batch; `--limit --chunk --out`) → `assignment-desk-load.py [--dry]` → `corner_assignments` (per-mode commission thresholds fit≥7/the_lens≥9/radical_critique≥8; below-threshold kept as status='declined'; engine='claude-sonnet-5', prompt_version='ad-v1'). `worker/h-reassign.py emit|submit|fetch|load --topn 70` (MODE H re-scoring, additive upsert).
- `worker/engine-writer.py emit|submit|fetch` (writer batches; model per mode: fan_theories/concept_briefing=`claude-sonnet-5`, meta/radical/reception_meta/juxtaposition/the_lens=`claude-opus-4-8`; web_search tool; rework via `--rework`); `engine-wave.py --wave wN --size-g N` (orchestrator: effort A=high/G=medium, 90-min stall auto-cancel/resubmit, 64-char custom_id map, checkpoint resume, nohup); `engine-normalize.py` / `engine-ko-normalize.py` / `rerun-joined.py` (output normalization + unrecovered rerun); `engine-verify.py` (A: Opus fact + Haiku mech), `engine-verify-g.py` (G: Opus + theory_concepts lookup — never inject whole DB), `engine-verify-x.py` (B/C/D/E/F, prompts `worker/verify-systems/<mode>.md`), `engine-judge-a.py` (merge verdicts); `engine-sync.py --in --out --format writer|verdict|ko --workers 5` (sync parallel for pilots ≲50 — memory rule: small tests sync, not Batch); `engine-translate.py emit|submit|fetch|check` (KO: Sonnet 5 translate + Haiku lock-check); `engine-ingest.py [--dry]` (→ `essays` status='verified', `essay_registry`, `corner_assignments`); `legacy-backfill.py [--dry]` (legacy essays → `essays`, canonical manifest, EN/KO pair_id); `registry-seed.py [--dry]` (initial `essay_registry`); `worker/build-entity-links.py [--truncate]` (deterministic essay→concept/theorist mentions → `essay_entity_links`, LLM 0).
POST-RUNBOOK; publication path = `/film/[slug]/[desk]`; ⚠️ wave-4 drafts (1,998) local, generation frozen.

## 19. FRAMES / QUESTIONS layer (Curious)

`worker/frame-discovery.py` (embed published questions, agglomerative cluster, **Gemini** naming; report-only → `frame-candidates.json`; `--threshold`), `frame-import.py [--dry]` (candidates → frames status='candidate' + `question_frames`, idempotent by slug), `frame-classify.py [--limit --dry]` (unclassified questions → one frame or orphan pool via `content_events`), `frame-rank.py --slug|--all-gated [--approve]` (approve + `frame_rankings` replace; gate = ≥5 published instances), `frame-slots.py [--slug --force]` (fill `question_frames.slots`). Launchers `worker/run-frame-*.command`. ⚠️ frame page gate trap noted in sitemap-gap memory.

## 20. BLOG / NEWSLETTER / HOURLY NEWS

- Blog: `worker/blog-parse.py` (pure parse, no net) → `blog-ingest.py [--persist --force]` (verifies every internal /film /take /trope link resolves; aborts on 404 unless `--force`; upserts `posts`) or `blog-emit-sql.py --date --meta` (dollar-quoted DELETE+INSERT for MCP execute_sql). `blog-send.py` (Resend; `RESEND_API_KEY`; DRY default, `--test addr`, `--send [--force] [--slug]`; reads `newsletter_subscribers`; marks `sent_at`).
- Hourly Now Playing (`hourly/`, canonical doc root `HANDOFF-now-플레잉.md` — **read before touching**): `poller/poller.py` (free signal stack detect, dry-run logs), `poller/sync_entities.py` (corpus entity cache), `pipeline/produce.py` (DETECT→SELECT→datapack→WRITE Fable 5+web_search→GATE→PUBLISH insert+revalidate+IndexNow+Bluesky/Telegram; hard rules: HOLD kill switch, daily cap 4, 48h novelty, corpus-depth ≥3 modules, ≥2 outlets, internal-only body links, defamation gate), `pipeline/stream.py` (→ `now_stream`), `pipeline/digest.py [date]` (→ `now_digests`), `pipeline/publish_draft.py <draft.json>`, `pipeline/rewrite_now.py <slug>` (same URL, dateModified bump), `pipeline/backfill_now.py <slug>` (structural only), `pipeline/datapack.py` (deterministic SQL, no LLM). Watcher `hourly/now-playing-watch.sh` (nohup loop; ⚠️ launchd/cron TCC-blocked in ~/Documents — same for gsc watcher; all watchers need restart after reboot). ⚠️ Reddit automation forbidden. |

## 21. CURATION / SCORING / TV / I18N / NAMING / INTENT — status

- **Curation (to.W)**: `curation-handover/02-phase0/phase0_origin_backfill.py`, `phase0_finalize_via_rest.py` (+`run-phase0-finalize.command`), `mainstream_enumerate.py` — TMDB `production_countries` authoritative origin + country-hub rebuild. Comment assembly rules live in DB table `curation.rule` (canonical; doc root `HANDOFF-투두블유-큐레이션코멘트.md`). No per-film worker script for tow_comment/director_curation regeneration found in worker/ — VERIFY (likely SQL/rule-driven).
- **Scoring (TakeScore/cinecodex)**: no scoring worker in `worker/` — the LLM (sonnet) grader that fills `cinecodex.scores` is **not in this repo scan — UNKNOWN/VERIFY**. Page prose is rule-based (LLM 0). Bulk read standard: RPC `takescore_for_slugs`; card RPC `cinecodex_card`; histogram `cinecodex_histogram`.
- **TV layer**: no Python workers; built via migrations 0059–0061 (`tv_*` tables, RPCs `tv_watch`/`tv_reel` — ⚠️ function-level `set statement_timeout` needed for anon). `worker/film-clips.py` is the only video collector. `hourly/tv/` = strategy + rendered prototype (render/upload loop blocked on ffmpeg + OAuth, owner task).
- **i18n**: `worker/ko-aliases.py` only. The autonomous translation loop (`content_i18n` + `source_sha256` reconciler → cron) from `HANDOFF-한국어화-i18n-마스터.md`: **no matching script found anywhere in repo (grep content_i18n = 0 hits) — planned/external, VERIFY before assuming it runs**.
- **Naming toolkit** (8-axis film naming, memory: `outputs/film_batch`): directory not found (`Outputs/` contains only `Drive_My_Car`, `figure_seo`) — UNKNOWN/VERIFY location; per memory it used REST + SKIP LOCKED + Anthropic Message Batches (~$145/1900).
- **Intent coverage**: only SQL in worker/ (`0079_intent_queue.sql`, `0080_intent_queue_v2.sql`); no worker script yet (program plan `docs/PLAN-intent-coverage.md`).
- **Misc**: `worker/apply-sql.py <file.sql|->` — Supabase Management API executor; env `SUPABASE_ACCESS_TOKEN` (the `sbp_` token), project hardcoded `jvgarcqrtsmgfimdcwgo`. `worker/ask-eval.py` (live /api/ask QA; `ASK_URL`). `scripts/build-theorist-portraits.mjs` (Wikidata P18 → `lib/theorist_portrait.json`; rerun when `lib/theorist_qid.json` changes). `scripts/import-selftest.ts` (/me/import server-side validation). `cinema_silhouette_render.py` (root, one-off render asset).
- **LEGACY (retired meta-take/register/reading/question engine)**: `worker/src/*.ts` + `worker/dist/*` (curiobot, generator, graph, publisher, reaudit, kyniqbot — the old TS question/reading generation loops), `worker/mt-import.py`, `worker/mt-clean.py`, `worker/figure-enrich.py` (register-era; slug backfill duty survives), `worker/Dockerfile`. Do not build new-film flow on these.

---

## 22. DANGEROUS SCRIPTS (never in an automated importer)

1. `trope-build.py --persist --reset` — wipes ALL trope hubs+members, new slugs (and run-pipeline-finish.command invokes exactly this ⚠️ — an importer factory must replace that step with `trope-incremental.py`).
2. `trope-persist.py --apply` — retires ~1,400 tropes / clears ~45k members; recovery only via `_bak_trope_*`.
3. `trope-consolidate(-apply).py --persist` — reading→trope fold, corpus-wide.
4. `mt-recluster.py --persist`, `mt-dedupe-rename.py --persist`, `mt-retitle-splits.py --persist` — rename live hub titles/slugs, null `seo_phrase`; require `merged_into`/`slug_history` redirect integrity.
5. `galaxy-build.py` (no flag) — full t-SNE rebuild moves every map coordinate; quarterly only.
6. `mt-import.py --fresh` — deletes figures/takes/meta_takes.
7. `film-extract.py --reset` — deletes named films' AI figures (guard: explicit `--film` required).
8. `theory-import.py` — truncates `theory_canon` before load.
9. `compute_film_scores` (RPC, not a worker) — ⚠️ memory: needs lineage + does a **global delete**; forbidden for per-film backfill.
10. `blog-send.py --send` — real email blast.

## 23. ENV VAR CENSUS

`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (all DB writers) · `SUPABASE_ACCESS_TOKEN` (sbp_, apply-sql.py only) · `ANTHROPIC_API_KEY` (all Claude gen/batch) · `OPENAI_API_KEY` (mt-embed, concept-embed, essay-embed, theory-canon-embed, trope-build, magazine-ingest, frame-*) · `GEMINI_API_KEY` (film-features, frame-discovery, trope-build optional) · `TMDB_READ_TOKEN` · `OMDB_API_KEY` · `YOUTUBE_API_KEY` · `BRAVE_API_KEY` (director-facts-gen hard-required; reception-run soft) · `TAVILY_API_KEY` (geo-extract-search) · `GOOGLE_MAPS_KEY` (geo-code, optional→Nominatim) · `RESEND_API_KEY` (blog-send) · `GSC_SA_JSON`/`GSC_PROPERTY` (gsc-pull) · `GEO_MODEL`/`GEO_WORKERS`/`GEO_MIN_SOURCES`/`GEO_BATCH_MODEL`/`GEO_FILMS` · `ASK_URL` (ask-eval).

## 24. MODEL ROUTING SUMMARY

Opus `claude-opus-4-8`: film-extract(+batch), bold-take, asset, mt-author, mt-recluster/dedupe/retitle, trope naming/gate, director profile/picks/facts-writer, figure_seo, engine modes B/C/D/E/F/G verify + heavy writers. Sonnet `claude-sonnet-4-6`: next-gen, catalog-map-run/char, geo-extract-search, director-facts judge. Sonnet 5 `claude-sonnet-5`: assignment-desk, engine A/G writers, engine-translate, geo-batch-submit, h-reassign. Haiku `claude-haiku-4-5(-20251001)`: mt-seo-batch, geo-extract, engine mech-check/translate-lock. Gemini: film-features (gemini-3.5-flash), frame-discovery naming, figure-enrich default (legacy). Embeddings: OpenAI `text-embedding-3-small` 1536-d everywhere. Batch API users: film-extract-batch, bold-take-batch, asset-batch, next-batch, mt-seo-batch, catalog-map-run/char, trope-gate-batch, director-{profile,picks}-batch, assignment-desk-batch, engine-writer/verify/translate, geo-batch-submit, figure_seo/batch_submit. Sync-only: film-extract, figure-enrich, film-features, trope-tag, geo-extract, director-facts-gen, engine-sync, all loaders/embedders. Rule (memory): pilots ≲50 = sync parallel, bulk = Batch; subscription cannot bulk-Opus — use Message Batches API.

## 25. GAPS the importer factory must close (as documented in RUNBOOK §6 + observed)

- No single `ingest-new.command <titles.csv>` wrapper (Stage 1→2→3→10→11→12→13 fan-out) — RUNBOOK §6.A.
- `films.visible` trigger (≥3 approved figures, auto-flip both ways) exists only in live DB, **not in `supabase/migrations/`** — ⚠️VERIFY/capture (RUNBOOK Stage 14). Noindex gate: `app/film/[slug]/page.tsx` requires `figures>=3 && visible`; sitemaps filter `visible=true`. A film extracting <3 figures stays silently noindexed — no alert.
- Additive consolidate (`mt-consolidate.py --incremental`) does not exist; only trope layer has the additive path (`trope-incremental.py`); new-trope FORMATION for unmatched takes deferred to supervised gardening.
- Tradition match (Stage 8) manual; Stage 16 director_embedding refresh SQL-only; sentence layer (Stage 18) SQL-only; film_next reverse-target backfill is a manual one-liner (§4.3d); counterpoint rebuild = 2 SQL blocks in `supabase/rpc/counterpoints.sql` header.
- Per-film SEO intros (beyond hub seo_phrase) — BACKLOG.
- Post-ingest verification checklist (RUNBOOK §7) is manual: figures.slug null=0, genres/overview present, ≥3 figures, framework/figure_taxonomy/film_next/film_reception/film_asset rows, no un-redirected slug change, search/surprise spot-checks.