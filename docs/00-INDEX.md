# Metatake — docs index (start here)

**The site:** metatake.net — an AI "critical map of cinema." Next.js (App Router) + Supabase + Vercel.

**The model in 3 lines:**
1. `film → figure → take`; each take has a **framework** (one of 14 "Strong Misreadings", `lib/frameworks.ts`) and a **trope** (`meta_takes.kind='figure_type'`).
2. Figures are classified into the **Catalog/Archetype** taxonomy (`taxonomy_nodes` + `figure_taxonomy`).
3. The old **meta-take / register / reading-hub** model is **retired** — don't rebuild it.

---

## The 4 docs that matter (keep these current)

| Doc | Owns |
|---|---|
| **[STATE.md](./STATE.md)** | Where we are now: model, live counts, site map, data model, shipped/pending. *Update every session.* |
| **[RUNBOOK-new-film-ingestion.md](./RUNBOOK-new-film-ingestion.md)** | How a new film becomes live pages: full ordered pipeline, batch/parallel/gate, fragilities, and the path to full automation. |
| **[BACKLOG.md](./BACKLOG.md)** | Everything not done yet: ingestion automation, pipeline gaps, SEO, quality (aliases, node-graph), features, doc hygiene, decisions, open questions. |
| **[CONCEPT-tropes-and-strong-misreadings.md](./CONCEPT-tropes-and-strong-misreadings.md)** | The conceptual canon + About/manifesto copy. Definitions of Figure / Strong Misreading / Trope / Catalog. |
| **[FRONTEND-DISCOVERY-AND-DECISIONS.md](./FRONTEND-DISCOVERY-AND-DECISIONS.md)** | The discovery/front-end layer: The Map (engine + 3 surfaces + recenter), home "Surprise me" (`surprise_home` modes), home v7, newsletter/editions, sticky nav, CSS conventions + hard-won lessons, locked UX decisions, and what a new film needs to light it all up. |

## `/room` — personal cinema-asset OS (SHIPPED, major) 🟢
The dark "operating-system" terminal (12 routes) that fuses TakeScore + 정전가 + taste vectors into a personal portfolio OS. Keep-current docs:
- **[ux/ROOM-LOGIC-AUDIT.md](./ux/ROOM-LOGIC-AUDIT.md)** — **section-by-section logic/link/privacy audit + P0–P3 reinforcement roadmap** (open items: `me_coverage`/`me_blindspots` don't exist yet; write-actions local-only except `rate_film`; pair=stub; ticker partly hardcoded). *Living — update as room work lands.*
- `docs/ux/PLAN-room-implementation.md` — build plan (Phase-1 era; partly historical now).
- `docs/ux/HTML-DESIGN-HANDOFF.md` — visual design intent; `docs/ux/SHARED-STANDARD.md` — S1–S11 display rules; per-mockup UX docs (`command-center.md`, `collection.md`, …).

## Design plans (status flipped to live where shipped)
- `docs/HANDOFF-데이터사업-마스터.md` — **데이터 사업 최상위 인수인계 (2026-07-03)**: 왜/조사 결과/확정 결정(컨텍스트 팩 선행→API 승격 판정)/실행 W1–W4/판정 기준. **데이터 사업 관련 세션은 여기서 시작.**
- `docs/PLAN-api-service.md` — **API 서비스 사업 기획 (2026-07-03)**: 타당성 검토(4개 병렬 리서치) + 자산 분류(판매가능/불가) + 4제품·2채널 설계 + 가격 + 법적 게이트 + 수익/비용 + 로드맵. 상태: 검토 완료, 실행 대기.
- `docs/PLAN-ai-context-packs.md` — **AI 컨텍스트 팩 (파일 제공형, 2026-07-03)**: API 대신/이전에 파일·복사 방식으로 판매 — L0 무료 Copy-for-AI 버튼 → Creator Pass/번들/Corpus 4단, 팩 포맷, 봇 대응(지문·벌크 게이트), 구현 3–5일. 상태: 기획 완료, API보다 선행 권고.
- `docs/PLAN-cinecodex-integration.md` — **Cinecodex → TakeScore (SHIPPED)**: all 6,701 films scored in isolated `cinecodex` schema; **`/takescore`** (current canonical; `/score`,`/codex` earlier names) + sitewide **TS poster badges** + `/room` eval card + Pass-2 confidence. Never-blend enforced. Monitor: `cinecodex_progress()`.
- `docs/WORKORDER-cinecodex-scoring.md` — Cinecodex V/C/R/U/S + 13 sub-scores via Anthropic Batch API into the **isolated `cinecodex` schema** (keyed to `public.films.id`; external metrics from `film_ratings`, never blended). Source design in `score/`.
- `docs/PLAN-personalization-portfolio.md` — **`/me` + `/room` (SHIPPED)**: 정전가 + taste vectors + NAV + WWI λ recommender. `user_movies`/`film_scores`/`film_taste_vector` live.
- `docs/HANDOFF-IMPORT.md` — **관람기록 통합 임포트 `/me/import` (SHIPPED 2026-07-03)**: Letterboxd ZIP·IMDb CSV·엑셀·왓챠·텍스트 자동감지 → TMDB 매칭 검수 → `user_watch_log`(무손실)+`user_movies`(집계). **문서 상단 ⭐진행상황 섹션이 최신** — 남은 건 로그인 브라우저 클릭스루뿐. 설계 배경: `docs/IMPORT-watch-history-design.md`. 파서 회귀: `scripts/import-selftest.ts`.
- `docs/PLAN-geographic-atlas.md` — **geographic Atlas (SHIPPED)**: `film_locations` (9,731 located) + `geo_cache` (3,951) + MapLibre `/atlas` + film/director Atlas tabs + `/room/atlas`.
- `docs/PLAN-cinemas-phase2.md` — **"Movements" (`/movements`, SHIPPED)**: origin/tradition axis (national cinemas + waves). ≠ geographic Atlas. Feeds personalization.
- `docs/PLAN-curation-integration.md` — the **curation editorial brain** (authority×demand quadrants, country/region hubs, `should_index`). Bridge (`public.film_curation` view + `curation_drift()`) live; Phase-0 finalizer pending.
- `docs/PLAN-taxonomy.md` — Catalog/Archetype layer (shipped)
- `docs/PLAN-trope-reformation.md` — trope pipeline detail
- `영화사이트_구조_고민과_해법.md` — 2-tier catalog (watchlists) strategy

## Scoped sub-projects (self-contained bundles)
- `handoff/` — Lineage (계보) tag layer (canon/awards/festivals) — **SHIPPED** (`/lineage`, `film_lineage` 10,551)
- `magazine research agent/` — reception research sub-agent

## Operational scratch (lives with code, not "project docs")
- `worker/*.md` (DRY-run samples), `substack/` (publishing log), `Element/` + `Asset/` (catalog/recommendation design), various `*/README.md`.

## Legacy / superseded → to be archived
Pre-migration docs still teaching the old model (root `MASTER.md`, `meta-take-architecture.md`, `START-HERE.md`, `SPEC.md`, all `mission-*.md`, root `HANDOFF-*.md`, `docs/STATE-2026-06-17.md`, `docs/RUNBOOK-bigbang.md`, and the entire **duplicate `filmcurio-bundle/`**). Pending your OK to move into `archive/` (BACKLOG §F).
