# BACKLOG — undone work, gaps, decisions

**Purpose:** the single registry of what's *not* done yet, so nothing is lost. Grouped by theme; each item has a rough size and why it matters. Update in place. Last: 2026-06-24.

Priority legend: 🔴 blocks scale/correctness · 🟡 quality/SEO · 🟢 feature/nice.

---

## A. Ingestion automation (toward "list of titles → automatic, parallel")
See `RUNBOOK-new-film-ingestion.md` §6 for the design.

- 🟡 **Incremental / additive corpus stages.** Re-clustering the whole corpus can rename/re-link live entities. Assign new takes to nearest existing hub/trope; only *create* when nothing fits; **never rename/re-link existing**. Full re-cluster → scheduled "garden" pass.
  - ✅ **DONE — trope layer:** `worker/trope-incremental.py` + RPC `trope_match_takes`. Additive assign of new/unassigned takes → nearest published trope by embedding (default thresh 0.72); writes `takes.trope_id` + `figure_type_members` only. DRY default; `run-trope-incremental-dry.command`. Never touches existing tropes.
  - ⏳ **Pending:** new-trope formation for unmatched takes (cluster→gate→name); `mt-consolidate.py --incremental` for legacy reading hubs (low pri); scheduled monthly "garden" full-recluster (the only place renames happen, with redirects).
- 🔴 **One ingest wrapper** `ingest-new.command <titles.csv>` chaining per-film Stages 1→2→3→10→11→12→13 in parallel batches, surfacing only the resolve-confidence review gate. *(Low–medium.)*
- 🟡 **Combined per-stage batches** across all new films (one Batch submission per stage, not per film) for cost + throughput. *(Low.)*
- 🟡 **<3-figure alert** at end of ingest (films silently noindexed otherwise). *(Low.)*

## B. Pipeline gaps & fragilities (correctness)
- 🔴 **Schema capture into VCS.** `films.visible/is_analyzed`, the **visible≥3-figures trigger**, and many catalog/trope/reception/watch-next/ask RPCs live only in the live DB, not in `supabase/migrations/`. Dump them to migration files so the DB is reproducible. *(Medium.)*
- 🔴 **Tradition match automation.** `theory-import.py` defers tradition matching to a manual "tell Claude to backfill." Build a real worker (trigram → embedding match `raw_concept` → `theory_canon`). *(Medium.)*
- 🟡 **Resolve low-confidence review queue.** `tmdb-resolve.py` drops/holds low-confidence matches silently; wrapper should pause on a review file. *(Low.)*
- 🟡 **Backfill guards** (figure slug; film genres/overview) as an automated post-step + assertion, not memory. *(Low.)*
- 🟡 **Redirect integrity check** after any rename (recluster/trope-build): assert every retired slug has `slug_history`/`merged_into`. *(Low.)*

## C. SEO (your example: new head-copy)
- 🟡 **Per-page head-copy / intros.** Per-**film** dossiers and per-**framework** intro copy for `<title>`/meta/H1 are thin or missing (hub `seo_phrase` exists via `mt-seo-batch`, but films + frameworks need their own). Design a head-copy generator (Haiku/Sonnet batch) writing a `seo_*` field per film + framework. *(Medium.)*
- 🟡 **Re-run hub seo_phrase after renames** (recluster nulls it). Fold into the garden pass. *(Low.)*
- 🟡 **strong-misreadings sitemap + canonical/og** completeness; **S2 perf** (materialize counts, home_bundle cache, tz) — carried from roadmap. *(Medium.)*

## D. Quality / refinement (your examples: figure aliases, node-graph calc)
- 🟡 **Figure aliases (별칭).** Same figure/character recurs across films under different labels; no alias layer. Add `figure_aliases` (or reuse `meta_take_aliases` pattern) so search + cross-film linking resolve synonyms. Needs a design: manual seed vs embedding-clustered candidates. *(Medium; needs design.)*
- 🟡 **Node-graph calculation.** Current graph neighbor RPCs (`graph_*_neighbors/seed`) use simple similarity/affinity weights. Improve edge scoring (rarity-weighting, mixing trope + framework + affinity signals, de-hairballing). *(Medium; needs design.)*
- 🟢 **Trope granularity review.** 4,710 active tropes is fine-grained; revisit merge thresholds in a garden pass if too sparse. *(Low; later.)*
- 🟢 **mt-relate.py + "differences/related" link tokens** between hubs (carried from roadmap #147). *(Medium.)*

## E. Features pending
- ✅ **DONE — Why-watch data load.** `film_asset` = 1,957 (loaded, live). Drives the film-page Why-watch tab + the Surprise `why_watch` card.
- 🟢 **Watchlists Phase 3 — promotion.** Behavior-driven: heavily-tracked Tier-2 films auto-promoted to full analysis (film-extract). Needs trigger + badge. *(Medium.)*
- 🟢 **Catalog: Concepts → Theory absorption** (roadmap #202). *(Medium.)*
- 🟢 **Personalization portfolio `/me`** (Bloomberg-style film-asset terminal) — `docs/PLAN-personalization-portfolio.md`. *(Large.)*
- 🟢 **Lineage (계보) tag layer** — canon/awards/festivals; self-contained spec in `handoff/`. *(Large; separate sub-project.)*
- 🟢 **takes HNSW** speed refinement (roadmap R1). *(Low.)*
- **`/me/import` 후속 (기능 자체는 SHIPPED 2026-07-03 — `docs/HANDOFF-IMPORT.md`):**
  - 🔴 **마감 확인**: 로그인 브라우저에서 위저드 클릭스루(§7 A~F) + 커밋 후 DB 무손실 검증. 서버사이드는 전부 검증 완료. *(Small — 사용자 로그인 필요.)*
  - 🟢 임포트 이력 화면 (`user_import_jobs` 목록). *(Small.)*
  - 🟢 실행 취소 — `import_job_id` 단위 `user_watch_log` 삭제 + `user_movies` 재집계. *(Medium.)*
  - 🟢 `/u/[username]` 공개 프로필에 관람 이력 반영. *(Small.)*
  - 🟢 왓챠 공식 CSV 백업 포맷 대응 강화. *(Small.)*

## F. Doc hygiene (needs your OK — destructive)
~150 .md files; the model migrated (meta-take/register/frames → Strong-Misreadings/trope/catalog), so many docs teach the *wrong* model.
- **Archive** legacy root docs + the entire duplicate `filmcurio-bundle/` into `archive/` (don't delete outright). Tier-3/4 list in the docs audit.
- **Keep as source of truth:** `docs/STATE.md`, `docs/RUNBOOK-new-film-ingestion.md`, `docs/BACKLOG.md` (this), `docs/CONCEPT-tropes-and-strong-misreadings.md`, active plans in `docs/PLAN-*.md`, scoped bundles `handoff/` + `magazine research agent/`.
- **Rewrite** the root `00-INDEX.md` (done → see `docs/00-INDEX.md`).

## G. Discovery layer (Map / Surprise / Home / Newsletter) — shipped 2026-06-27
Full design in `FRONTEND-DISCOVERY-AND-DECISIONS.md`. Remaining:
- 🔴 **Capture discovery schema into VCS.** `map_overview`, `map_ego`, `map_film_*`, `map_director_*`, `surprise_home`, `director_embedding` (+ HNSW) live only in the live DB. Dump to migrations (folds into §B schema capture). *(Medium.)* — *(search RPCs `search_all`/`search_semantic`/`film_search` now committed in `0040`/`0041`; `map_search` retired, no capture needed.)*
- 🟡 **`refresh_director_embeddings()` RPC + button.** `director_embedding` (avg of figure embeddings/director) was built by ad-hoc SQL; needs a re-runnable RPC so new directors get a similarity ring. *(Low–medium.)*
- 🟡 **Auto director-generation for new auteurs.** When ingest adds a film by a director with no `director_portrait/picks/facts/next`, trigger Stage 15 + Stage 16 (RUNBOOK). Today it's manual. *(Medium.)*
- 🟢 **Figure-map density.** `map_ego` figure branch is 3-level (figure→trope→film); recenter unfolds more. Optionally raise `hf` limits / add idea-shared films for richer first view. *(Low.)*
- 🟢 **Map perf at scale.** `map_overview`/ego are fine at ~2k films; revisit node caps + edge de-hairballing if the corpus 5×'s. *(Later.)*
- 🟢 **Surprise tuning.** Frequencies (≈⅓ misreading, ≈1/20 chip cards) are hard-coded in `surprise_home()`; expose as constants if we want to A/B. *(Low.)*

---

## Decisions log (resolved)
- **Discovery layer (2026-06-27):** The Map = one `EntityGraph` engine, three surfaces (`/map` explorer · embedded `EntityMap` w/ recenter-in-place · Surprise panel). Home "Surprise me" uses a *separate* `surprise_home()` (film-anchored, Concept/Idea dropped, ≥⅓ Strong Misreading) — the `/random` page + `surprise()` are left intact. Sticky nav via `.mthome--bare{display:contents}`. Newsletter/blog cards use real editions w/ specific headlines. Reusing the `sm-` class prefix across unrelated components is banned (scoped `/random` under `.sm-page`).
- Keep `films.id` uuid PK (NOT re-key to tmdb_id). Watchlists use a dedicated `user_movies` table; Tier-2 = `visible=false` rows; lazy TMDB import via server routes.
- Reception = Reviews only (academic Scholarship shelved for page density).
- Why-watch = 8 fixed lenses, Opus, bold-label format, confident-only awards.
- Quality-mode reshaping (recluster/trope-reset/persist) stays supervised, excluded from auto orchestrators.

## Open questions (for discussion)
1. Incremental-additive vs periodic full re-cluster — confirm the "garden pass" cadence (monthly?).
2. Figure aliases: manual-seed first, or embedding-candidate generation?
3. Node-graph: what signals matter most to you (trope-sharing, framework-sharing, affinity, theorist)?
4. Doc archival: OK to move legacy + `filmcurio-bundle/` into `archive/`?
5. SEO head-copy: per-film + per-framework — tone/length you want?
