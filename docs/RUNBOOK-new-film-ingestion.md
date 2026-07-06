# RUNBOOK — New-Film Ingestion (the master pipeline)

**Owner doc for:** "I have a list of film titles. How do they become fully integrated pages on metatake.net?"
**Last reconstructed:** 2026-06-24 (from `worker/` + `*.command` audit). Verify items marked ⚠️VERIFY.

> Goal state: throw in a list of titles → near-automatic, parallel, fast → live. We are ~70% there. The per-film stages are already scripted and parallelizable; the blockers are (a) a few manual/ad-hoc steps and (b) the corpus-wide reshaping stages that re-touch the *whole* graph. This runbook documents what exists today and the plan to reach full automation.

---

## 0. The one principle that explains everything

Stages fall into **two classes**, and they must be treated differently:

- **Per-film stages** (1–3, 11–13): operate on each new film independently. *Naturally parallel*, safe to fan out, never touch existing films. → these are the "easy" automatable part.
- **Corpus-wide stages** (4–9): embeddings, hub consolidation, ranking, recommend, trope build, SEO. They **re-cluster and re-rank the entire published corpus**, so adding films can *rename/re-link existing live entities*. This is why a batch of new films cannot be cleanly isolated, and why these stages stay supervised. → the "hard" part; the automation goal is to make these **additive-only** (see §6).

Keep this split in mind for every decision below.

---

## 1. What already orchestrates the pipeline (today)

Two double-click scripts chain the corpus-wide middle safely; the ends are manual.

| Script | Covers | Mode |
|---|---|---|
| `worker/run-pipeline-auto.command` | P0 wait → **P3 embed → P4 consolidate → P5a author → P5b rank → P5c recommend** | unattended, idempotent |
| `worker/run-pipeline-finish.command` | P0 wait → **P6b trope-build → P8 SEO** (stops before P9) | unattended |
| (manual) | Stage 1–3 (resolve, TMDB, extract) and Stage 9 (integrity + deploy) | supervised |

`pipeline-wait-batch.py` / `pipeline-wait-tropetag.py` (P0) just block until table writes go quiet — they guard *timing*, not *correctness*.

---

## 2. Model usage at a glance

- **Opus** `claude-opus-4-8` — film-extract, bold-take/asset, figure-enrich, hub authoring/recluster, trope naming/gate
- **Sonnet** `claude-sonnet-4-6` — watch-next, catalog/archetype mapping
- **Haiku** `claude-haiku-4-5` — SEO phrases
- **Embeddings** OpenAI `text-embedding-3-small` (1536-d) — everything
- **Anthropic Batch API (~50% off)** used by: `film-extract-batch`, `bold-take-batch`, `asset-batch`, `next-batch`, `mt-seo-batch`, `catalog-map-run`/`catalog-map-char`, `trope-gate-batch`

---

## 3. The full ordered chain (stage → script → class → writes → risk)

### Stage 1 — Title → tmdb_id (director-disambiguated)  ·  PER-FILM, manual gate
- **Script:** `worker/tmdb-resolve.py` (`run-tmdb-resolve*.command`)
- **Writes:** `films(tmdb_id, title, year, director, director_slug, slug)` on conflict tmdb_id; **high/medium confidence only** unless `--include-low`.
- **Slug:** `slugify(title)-year` with collision avoidance.
- **Risk:** low-confidence rows are silent → must eyeball; a wrong director match attaches the whole downstream graph to the wrong film.

### Stage 2 — TMDB metadata + media  ·  PER-FILM, parallel — MUST precede Stage 3
- **Script:** `worker/tmdb-fetch.py` (`run-tmdb-fetch-new.command`)
- **Writes:** `films`(overview, genres, backdrop, tagline, runtime, release_date, certification, poster_path, tmdb_extra=cast); `media`(backdrops, trailer, director profile — deletes prior AI media first, idempotent); `directors`.
- **Risk:** if `genres`/`overview` are missing here, every film clusters as genre "Other" and extract loses cast context. **Non-negotiable before extract.**

### Stage 3 — Figures + takes (the content)  ·  PER-FILM, batch
- **Scripts:** `worker/film-extract-batch.py` (`--submit`/`--fetch`, Batch API, Opus) — base figures/takes. Then the Strong-Misreading layer: `worker/bold-take-gen.py → bold-take-batch.py → boldtake-load.py` (writes `takes.framework`, `is_invitation`, theorist/concept; may create new figures).
- **Writes:** `figures` (6–8/film), `takes` (3 distinct frameworks/figure, status=published). Idempotent (skips films that already have figures).
- **Risk:** bold-take load creates figures with worker-assigned UUIDs — must land **before** P3 embed so they get embedded + clustered.

### Stage 4 — Embeddings  ·  CORPUS-WIDE (null-only), P3
- **Script:** `worker/mt-embed.py` (`run-sm-embed.command`). Writes `figures/takes/meta_takes.embedding` (null-only unless `--force`).

### Stage 5 — Hub consolidation + re-link  ·  ⚠️ CORPUS-WIDE FRAGILE, P4
- **Script:** `worker/mt-consolidate.py` (+`mt_consolidate_core.py`), `--persist`. Quality-mode (separate, supervised): `mt-recluster.py`, `mt-dedupe-rename.py`, `mt-retitle-splits.py`.
- **Writes:** dedups hubs (cosine ≥0.86), gates <5-film hubs, splits >70-figure hubs; **re-links `takes.meta_take_id`**, inserts child hubs, retires merged hubs (`merged_into` for 301s).
- **Risk (the fragile core):** generates **new hub slugs** and re-links takes across the *whole* corpus. recluster/dedupe/retitle **rename live hub titles/slugs** and null `seo_phrase`. URL integrity depends on `merged_into` + `slug_history` redirects.

### Stage 6 — Author → Rank → Recommend  ·  CORPUS-WIDE, P5a/b/c
- **Scripts:** `mt-author.py` (Opus; publishes hubs with ≥5 films, publish-then-audit), `mt-rank.py` (rankings), `mt-recommend.py` (**2026-07-04 rewritten** — `film_affinities` = trope TF-IDF + `film_taste_vector` cosine fused by RRF, top-24/film, evidence columns `cos`/`tfidf`/shared trope ids; drives /movies-like, film-page Connected, /map 'like' edges. Runs via chunked `conn_*` RPCs. **정본/불변식: `HANDOFF-연결엔진-커넥션.md`**).
- **Risk:** hubs that never reach 5 films stay unpublished candidates forever.

### Stage 7 — Tropes: tag → build  ·  ⚠️ CORPUS-WIDE FRAGILE, P6
- **Scripts:** `trope-tag.py` (1 call/film) → `pipeline-wait-tropetag.py` → `trope-build.py --persist --reset` (P6b). Quality re-form: `trope-form.py → trope-gate-batch.py (Batch) → trope-consolidate(-apply).py → trope-persist.py`.
- **Writes:** `figure_tags`; `meta_takes(kind=figure_type)` + `figure_type_members`; centroids/related; `takes.trope_id`.
- **Risk:** `trope-build --reset` **wipes ALL trope hubs+members and recreates with new slugs**. `trope-persist --apply` retires ~1,400 tropes / clears ~45k members. Reversible only via local `_bak_trope_*` snapshots. Re-running on a grown corpus renames live trope URLs.

### Stage 8 — Theory import + tradition match  ·  ⚠️ GAP (manual)
- **Script:** `worker/theory-import.py` loads `theory_canon`. **Tradition match is NOT automated** — theory-import prints "tell Claude to run tradition backfill"; matching is ad-hoc. See BACKLOG.

### Stage 9 — Per-page SEO phrases  ·  CORPUS-WIDE, P8
- **Script:** `worker/mt-seo-batch.py` (Batch, Haiku) → `meta_takes.seo_phrase` (null-only). **Must re-run after any hub rename** (recluster nulls it). Only covers hub phrases; per-film SEO intros are a gap (BACKLOG).

### Stage 10 — Catalog / archetype mapping  ·  PER-FILM-ish, batch
- **Scripts:** `catalog-load.py` (load `taxonomy_nodes` from `Element/*.xlsx`, one-time) → `catalog-map-run.py` (objects/locations) + `catalog-map-char.py` (characters), Batch, Sonnet → `figure_taxonomy`. Resumable.

### Stage 11 — Reception (critics)  ·  PER-FILM
- **Scripts:** `reception-discover.py → reception-run.py → reception-load.py` → `film_reception` (headlines + ≤15-word verbatim verdicts + link, copyright-safe). LLM reception essays: `film-features.py` (kind=reception) → `film_features`.

### Stage 12 — Watch-next (+ recommended-by reverse)  ·  PER-FILM, batch
- **Scripts:** `next-gen.py --emit-requests --all → next-batch.py submit/fetch (Batch, Sonnet) → next-resolve.py (DB match / TMDB verify / drop hallucinations) → next-load.py` → `film_next`. Reverse ("Recommended by") = `film_next_reverse` RPC over the same table.

### Stage 13 — Why-watch / asset  ·  PER-FILM, batch
- **Scripts:** `asset-gen.py → asset-batch.py → asset-load.py` (Batch, Opus) → `film_asset` (8 lenses). **Currently 0 rows loaded — batch pending** (`run-asset-fetch` → `run-asset-load`).

### Stage 14 — Visibility + deploy  ·  AUTOMATIC + supervised, P9
- **Visibility:** `films.visible` flips automatically via a **live DB trigger at ≥3 approved figures** (auto-reverses below 3). No manual SQL. ⚠️VERIFY: the trigger definition is not in `supabase/migrations/0001–0026` — it was applied directly to the live DB; **it must be captured in version control** (BACKLOG).
- **Noindex gate (app):** `app/film/[slug]/page.tsx` sets noindex unless `figures>=3 && visible`. `sitemap.ts`/indexes filter `visible=true`.
- **Deploy:** any `deploy-*.command` = `git add/commit/push` → Vercel auto-build (~2 min). Code deploy is separate from data build. (Note: a Mac watcher now auto-commits `app/components/lib` edits — see `FRONTEND-DISCOVERY-AND-DECISIONS.md §5`.)

### Stage 15 — Director generation layer  ·  PER-DIRECTOR (only for *new* directors), batch
Triggered when a new film introduces a director not already built. Powers the director page **and** the home Surprise director cards (`director_map`, `where_to_start`, `director_next`, `director_tropes/ideas`).
- **Scripts:** `worker/director-profile-{gen,batch,load}.py` → `director_portrait` + **who's-next** (`director_next`: rec_name, target_slug, profile_path, reason); `worker/director-facts-{gen,load}.py` → `director_facts` ("The Life", web-grounded ~30 facts); `worker/director-picks-{gen,batch,load}.py` → `director_picks` ("Where to start", ordered films + reasons). Opus, Batch API.
- **Risk:** a new director with none of these → director page is bare and the Surprise director cards silently fall back to misreading. Not auto-triggered today — run when ingesting films by new auteurs.

### Stage 16 — Director embedding refresh  ·  CORPUS-WIDE (null/new only)
- **What:** `director_embedding` (slug, embedding vector(1536), nfig + HNSW) = the **average of the director's figure embeddings**. Powers the **similarity ring** in the director map and director-mode overview.
- **How:** built/applied **directly in SQL** during the map work (no worker script yet) — re-run the avg-embedding upsert for directors whose films changed (depends on Stage 4 embeddings existing first). ⚠️ Capture this as a `refresh_director_embeddings()` RPC + button (BACKLOG).
- **Risk:** skip it and new directors have an empty similarity ring (map still renders their films, just no "directors nearby").

### Stage 17 — Geographic Atlas (place-name geocoding)  ·  PER-FILM, additive
Powers the **Atlas** tab (film + director pages) and the global **`/atlas`** map. Plan: `docs/PLAN-geographic-atlas.md`.
- **Scripts:** `worker/geo-extract.py` (LLM, threaded, DRY→`--apply`) → reads the film's `figures.kind='location'` + overview + takes, returns the REAL mappable places (skips fictional/interior), writes `film_locations` (layer='setting', coords NULL, `figure_id` linked). Then `worker/geo-code.py` (`--apply`) → dedupes distinct names through `geo_cache`, geocodes via **Google Geocoding** (`GOOGLE_MAPS_KEY`; 10k free/mo then $5/1k) or free **Nominatim**, writes lat/lng/precision/country. Buttons: `run-geo-extract-dry/apply.command`, `run-geo-code.command`.
- **New film:** `GEO_FILMS=<slug> run-geo-extract-apply.command` then `run-geo-code.command --apply` (only new distinct names get geocoded — cache makes it ~free). Additive — never touches other films.
- **Notes:** existing corpus was seeded once with knowledge-based coords (489 pins / 469 films); the Google pass refines `precision`. The real **filming-location** ("Filmed") layer is a future Phase 4 (the `movie-locations-project` agent, legal guardrails ON).
- **Risk:** vague/fictional places get no pin (intended — accuracy over coverage).

---

## 3b. Discovery layer (Map · Surprise · Home · Newsletter)

These surfaces are **derived and mostly automatic** — see `FRONTEND-DISCOVERY-AND-DECISIONS.md §7` for the full "what lights up automatically vs needs a step" matrix. Short version:
- **Automatic** once a film has figures/takes/tropes/ideas + TMDB media: every Map view, the film/figure/trope/idea connection maps, **unified site search** (`search_all`; semantic once embeddings land), and the Surprise modes `misreading`/`film_map`/`figure_links`/`film_tropes`/`film_ideas`.
- **Needs the pipeline tables filled:** Surprise `watch_next`/`recommended_by`/`why_watch` ← Stages 12–13 (`film_next`, `film_asset`).
- **Needs Stages 15–16:** all *director* surfaces for a new director.
- The Map/Surprise RPCs (`map_*`, `surprise_home`) are **read-only over the existing corpus** — they never need a per-film write, but they DO assume the above tables are populated.

---

## 4. Mandatory post-build backfills (easy to forget — run every batch)

1. **figure slug backfill** — extract/import don't always fill `figures.slug`; missing → figures render as dead text. Verify `count(*) from figures where slug is null = 0`.
2. **film genres/overview/media** — `run-tmdb-fetch-all.command`. Missing → genre "Other" collapse.
3. **Connection engine refresh** (after tropes/takes land — full recipe in `HANDOFF-연결엔진-커넥션.md`):
   a. `python3 worker/mt-recommend.py` — rebuilds `film_affinities` (movies-like·Connected·map 'like'까지 즉시 반영).
   b. counterpoint rebuild — the 2 SQL blocks in `supabase/rpc/counterpoints.sql` header (conn_film_trope_vec → entity_edges).
   c. new raw concepts? `python3 worker/concept-embed.py`(report) → `--write 0.70`.
   d. film_next 백필 1줄 — `update film_next fn set target_film_id=f.id from films f where fn.target_film_id is null and f.tmdb_id=fn.tmdb_id;` (새 영화가 기존 레코의 target이 됐을 때).
   e. galaxy 좌표(`worker/galaxy-build.py` / `--directors`)는 **분기 1회 정도만** — 재빌드=좌표 전면 이동(새 판). 새 감독 사진: `worker/director-profiles.py`.

---

## 5. Ordering hazards (the "don't do this" list)

- Stage 2 (TMDB) **before** Stage 3 (extract) — always.
- Stage 4 (embed) **before** 5/6/7 — everything keys off embeddings.
- bold-take/asset loads (create figures/takes) **before** P3 embed.
- SEO (Stage 9) **after** any hub rename.
- **Quality-mode scripts** (recluster, dedupe, retitle, `trope-build --reset`, `trope-persist`) reshape the **entire live graph**, not just new films. They are deliberately excluded from the auto orchestrators and must stay supervised with DRY review + redirects intact.
- A film that extracts <3 figures stays silently noindexed — no alert today.

---

## 6. Target: "list of titles → near-automatic, parallel" (the plan)

What we want vs what blocks it, and the work to close each gap. (Tracked in BACKLOG under "Ingestion automation".)

**A. Per-film fan-out wrapper (mostly exists).** One `ingest-new.command <titles.csv>` that runs Stages 1→2→3→10→11→12→13 per film, in parallel batches, with the manual gates surfaced as review prompts. *Gap:* a single wrapper that chains these and a resolve-confidence review step. Low effort.

**B. Make corpus-wide stages ADDITIVE-ONLY for incremental runs.** The fragility is that consolidate/trope-build re-touch everything. Target: an "incremental mode" that *assigns new figures/takes to existing hubs/tropes by nearest-centroid* and only **creates** new hubs when nothing fits — **never renames or re-links existing live entities**. Full re-clustering becomes a separate, scheduled, supervised "garden" pass (monthly), not part of every ingest.

  - ✅ **DONE — trope layer:** `worker/trope-incremental.py` (+ RPC `trope_match_takes`). For each new take (published, non-invitation, `trope_id IS NULL`) it finds the nearest existing published trope by embedding cosine (centroid = `meta_takes.embedding`); if sim ≥ threshold (default 0.72) it assigns `takes.trope_id` + adds `figure_type_members` via the existing `trope_set_take_tropeid` / `trope_insert_members` RPCs. Purely additive — never deletes, renames, re-slugs, or re-links any existing trope/member. DRY by default (prints similarity histogram + assign count). Scope with `--films <slug,slug>` (ingest) or `--all-null` (diagnostic). Validated: high-sim matches are thematically correct; gated-out takes cluster at 0.55–0.65 so a high threshold keeps precision. Button: `run-trope-incremental-dry.command`.
  - ⏳ **Still pending:** (a) new-trope FORMATION for takes that match nothing (cluster the unassigned, critic-gate, name) — currently left for the gardening pass; (b) same additive path for the legacy `reading`-kind hubs via `mt-consolidate.py --incremental` (low priority — readings unpublished); (c) the scheduled monthly "garden" full-recluster (the only place renames are allowed, with redirects). Medium effort.

**C. Automate the two manual steps.** (1) tradition match → a real worker. (2) resolve low-confidence → a review queue file the wrapper pauses on. Low-medium.

**D. Version-control the `films.visible` trigger** + add a "<3 figures" alert at end of ingest. Low.

**E. Parallelism.** Per-film stages already parallelize via Batch API; the wrapper should submit one combined batch per stage across all new films (not per film) to maximize the 50% discount and throughput.

When A–D land, the flow becomes: drop `titles.csv` → `ingest-new.command` (fans out per-film, additive corpus assignment, surfaces only the resolve-review gate) → deploy. The monthly "garden" pass handles re-clustering/renames with redirects.

---

## 7. Verification checklist (after any ingest)

- `figures where slug is null = 0`
- new films have `genres` and `overview` populated
- new films reached ≥3 figures (else investigate; they're noindexed)
- `takes.framework` populated for new takes; `figure_taxonomy` rows exist
- `film_next` / `film_reception` / `film_asset` rows exist for new films
- no live hub/trope URL changed slug without a `slug_history`/`merged_into` redirect
- deploy build READY on Vercel; spot-check 2–3 new film pages
- **discovery:** new film appears in **unified search** (`/api/search` → `search_all`, immediately; semantic leg once `takes.embedding`/`film_taste_vector` land); its `/film/[slug]` connection map renders (>1 node); a new director has Stage-15 rows + a `director_embedding` row (else director map similarity ring is empty)
- **surprise:** `/api/surprise/home` returns new-film cards across modes (it's random — sample a few); `film_asset`/`film_next` present so `why_watch`/`watch_next` cards aren't always falling back to misreading
