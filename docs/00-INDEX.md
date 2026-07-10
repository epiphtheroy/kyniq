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

## News & video layer — hourly desk → text → video (SHIPPED text / prototyped video) 🟢
The live news layer and its video spin-off. Both self-contained bundles under `hourly/`.
- `HANDOFF-now-플레잉.md` (루트) — **Now Playing 정본 (SHIPPED 2026-07-09, 자율 가동 중)**: 시간당 키워드 체이싱 뉴스 체계. 하루 3종(The Daily `/blog` · Now Playing 라이브 `/now` · 일간 다이제스트 `/now/daily/[date]`) + `/now/wire` + film/director "In the news" 탭. 순수 파이썬 stdlib 파이프라인, Fable 5 작성=발행(sonnet 게이트 없음). 워처 `hourly/now-playing-watch.sh`. 세부: `hourly/README.md`(레시피)·`DESIGN.md`·`TREND-SOURCES.md`·`DISTRIBUTION.md`·`FORECAST.md`(⚠️필독). **뉴스층 세션은 여기서 시작.**
- `HANDOFF-metatake-tv.md` (루트) — **Metatake TV 정본 (전략+프로토타입 완료 2026-07-09)**: `/now` 레터를 페이스리스 영상(Short+롱폼 단일 퍼널)으로 만들어 유튜브 배포. 데이터 반전=드라마=반슬롭 해자. 시네마틱 프로토타입 라이브(**metatake.net/tv/marie-antoinette.html**, 실제 스틸·Didot·그레인). 전략/포맷 세부: `hourly/tv/STRATEGY.md`. **렌더+업로드 루프는 ffmpeg 설치+채널/OAuth 대기(오너 몫).** ⚠️함정: 외부이미지 CSP(→base64), rAF 스로틀(→시간 명시 구동), public/ 수동 커밋. **영상 세션은 여기서 시작.**

## Design plans (status flipped to live where shipped)
- `HANDOFF-감독읽는층-리셉션-SEO.md` (루트) — **감독 기사층 · 리셉션/애프터라이프 · SEO 확장 (SHIPPED 2026-07-08~09)**: `/film/x/reception`(1,957) + 감독 8서브페이지(start·next·life·misreadings·takescore·honors·reception·theory) + `/curious/directors` + 누락 색인 4종 + 스포일러-존 탭바. **⚠️ 함정 필독: cinecodex_card 루프=DB다운(→lib/takescore-bulk.ts), null-poison 404(loader 에러-throw), 자동배포 churn 과부하.** 감독/리셉션/이론층/사이트맵/탭 세션은 여기서 시작. 상위 SEO는 `docs/HANDOFF-SEO-마스터.md` §3c.
- `HANDOFF-서프라이즈-v2채널-스트리밍.md` (루트) — **Surprise 확장 · v2 방송채널 · 릴 · 유튜브 검토 (2026-07-09)**: surprise_home **20모드**(reception/honors/question/locations/theorist/misreadings, 마이그 0050) + 미디어 16:9 고정 레이아웃수정 + `SurpriseStage` 공유컴포넌트로 `/random`=홈 통합. **`/random/v2`** "The Metatake Channel"(영상 풀스크린 + 에디토리얼 6 랜덤 컴포지션, `.svc-ed-*`/`.svc-comp-*`). **`/random/reel`** 30초 Short 시제품(스틸+SpeechSynthesis 낭독+WebAudio 앰비언트, RPC reel_cards 마이그 0051). 유튜브 스트리밍 기술·**Content ID** 저작권 검토(실행 보류). **⚠️ 함정: jsonb 빈-게이트는 `jsonb_typeof='null'` 필요 · `position:fixed;inset:0`는 longhand 필수.** Surprise/‌`/random`/v2/릴/유튜브 세션은 여기서 시작.
- `HANDOFF-사이트분석-퍼스트파티.md` (루트) — **퍼스트파티 애널리틱스 (SHIPPED 2026-07-10)**: 쿠키리스 비콘(`components/Metrics.tsx`) → `/api/metrics` → `mt_events`(마이그 0058, RLS 무정책=service-role 전용) → **`/admin/metrics`** 대시보드(KPI·시간대별 시계열·체류/스크롤·진입/이탈·세션 흐름·사이트내 검색어·클릭·vitals p75·페이지 드릴다운+GSC 쿼리). GSC 커넥터 `worker/gsc-pull.py`(⏳서비스계정=원우) · Clarity 슬롯(⏳`NEXT_PUBLIC_CLARITY_ID`). **⚠️ 함정: jsonb_agg 바깥 별칭=안쪽 컬럼명이면 to_jsonb가 컬럼으로 해석(0059로 수정).** 분석/대시보드 세션은 여기서 시작.
- `docs/HANDOFF-데이터사업-마스터.md` — **데이터 사업 최상위 인수인계 (2026-07-03)**: 왜/조사 결과/확정 결정(컨텍스트 팩 선행→API 승격 판정)/실행 W1–W4/판정 기준. **데이터 사업 관련 세션은 여기서 시작.**
- `docs/PLAN-api-service.md` — **API 서비스 사업 기획 (2026-07-03)**: 타당성 검토(4개 병렬 리서치) + 자산 분류(판매가능/불가) + 4제품·2채널 설계 + 가격 + 법적 게이트 + 수익/비용 + 로드맵. 상태: 검토 완료, 실행 대기.
- `docs/PLAN-ai-context-packs.md` — **AI 컨텍스트 팩 (파일 제공형, 2026-07-03)**: API 대신/이전에 파일·복사 방식으로 판매 — L0 무료 Copy-for-AI 버튼 → Creator Pass/번들/Corpus 4단, 팩 포맷, 봇 대응(지문·벌크 게이트), 구현 3–5일. 상태: 기획 완료, API보다 선행 권고.
- `docs/PLAN-cinecodex-integration.md` — **Cinecodex → TakeScore (SHIPPED)**: all 6,701 films scored in isolated `cinecodex` schema; **`/takescore`** (current canonical; `/score`,`/codex` earlier names) + sitewide **TS poster badges** + `/room` eval card + Pass-2 confidence. Never-blend enforced. Monitor: `cinecodex_progress()`.
- `docs/WORKORDER-cinecodex-scoring.md` — Cinecodex V/C/R/U/S + 13 sub-scores via Anthropic Batch API into the **isolated `cinecodex` schema** (keyed to `public.films.id`; external metrics from `film_ratings`, never blended). Source design in `score/`.
- `docs/PLAN-personalization-portfolio.md` — **`/me` + `/room` (SHIPPED)**: 정전가 + taste vectors + NAV + WWI λ recommender. `user_movies`/`film_scores`/`film_taste_vector` live.
- `docs/HANDOFF-IMPORT.md` — **관람기록 통합 임포트 `/me/import` (SHIPPED 2026-07-03)**: Letterboxd ZIP·IMDb CSV·엑셀·왓챠·텍스트 자동감지 → TMDB 매칭 검수 → `user_watch_log`(무손실)+`user_movies`(집계). **문서 상단 ⭐진행상황 섹션이 최신** — 남은 건 로그인 브라우저 클릭스루뿐. 설계 배경: `docs/IMPORT-watch-history-design.md`. 파서 회귀: `scripts/import-selftest.ts`.
- `HANDOFF-검색엔진-통합.md` (루트) — **통합 검색 엔진 (SHIPPED 2026-07-06)**: 사이트 전 검색표면(전역 `/search`·내비 타이프어헤드·전역 ⌘K 팔레트·홈 히어로·맵)을 단일 엔진 `lib/search.ts`→`/api/search`로 통합. 어휘 `search_all`(12종 엔티티, Tier-2 포함) + 시맨틱 `search_semantic`(pgvector 6레그, 27k 비평문 의미검색·교차언어) RRF 융합. 파편화된 `search_site`/`map_search`/`readings_suggest` 은퇴. **SQL 레포 정본**(`supabase/migrations/0040_search_v3.sql`+`0041`). **검색 관련 세션은 여기서 시작** — 파일맵·불변식·8앵글 리뷰 결과·남은 TODO 수록. 인덱스 운영: auto-memory `pgvector-hnsw-build-ops`.
- `docs/PLAN-connections-overhaul.md` — **연결 엔진 총재건 (SHIPPED 2026-07-04~05)**: 죽어 있던 `film_affinities` 재건(RRF: 트롭 TF-IDF+취향 cosine, 근거 컬럼) → **/movies-like 1,935p 부활**·랭킹 기사화, **counterpoint** 11k(같은 트롭·상반 독해), concept_map 정본화(40→62%), **/map Galaxy**(영화 1,941+감독 873, 썸네일·드리프트·뷰포트 패널), methodology 라이브 수치 타일, TS 포스터 배지 철거. 진단→실행 전 로그 수록. **운영 정본: 루트 `HANDOFF-연결엔진-커넥션.md`**, 인제스트 접점: RUNBOOK §4.3.
- `docs/PLAN-geographic-atlas.md` — **geographic Atlas (SHIPPED)**: `film_locations` (9,731 located) + `geo_cache` (3,951) + MapLibre `/atlas` + film/director Atlas tabs + `/room/atlas`.
- `docs/PLAN-cinemas-phase2.md` — **"Movements" (`/movements`, SHIPPED)**: origin/tradition axis (national cinemas + waves). ≠ geographic Atlas. Feeds personalization.
- `docs/PLAN-curation-integration.md` — the **curation editorial brain** (authority×demand quadrants, country/region hubs, `should_index`). Bridge (`public.film_curation` view + `curation_drift()`) live; Phase-0 finalizer pending.
- `docs/PLAN-taxonomy.md` — Catalog/Archetype layer (shipped)
- `docs/PLAN-trope-reformation.md` — trope pipeline detail
- `영화사이트_구조_고민과_해법.md` — 2-tier catalog (watchlists) strategy

## Scoped sub-projects (self-contained bundles)
- `handoff/` — Lineage (계보) tag layer (canon/awards/festivals) — **SHIPPED** (`/lineage`, `film_lineage` 10,551)
- `magazine research agent/` — reception research sub-agent
- `sentence-engine/` — **LLM-free sentence generator (SQL-only) — v2 "WOW Engine" 2026-07-10**. Postgres `format()` × DB joins → *surprise-ranked* sentences at $0/LLM=0/no-random. Wow features computed in SQL (node rarity, concept fanout, year gap, genre clash, double bonds) → 12 families, one sentence per pair, 42 paraphrase variants (md5-deterministic), `wow` score column, 4-beat pitch rhetoric (anchor→concretize→turn→warrant). Verified: *Parasite* 41 · *Persona* 39. Canonical: `sentence-engine/WOW_Engine_v2_EN.md`; start at `sentence-engine/README.md`. Not yet persisted/surfaced (원우 direction pending).

## Operational scratch (lives with code, not "project docs")
- `worker/*.md` (DRY-run samples), `substack/` (publishing log), `Element/` + `Asset/` (catalog/recommendation design), various `*/README.md`.

## Legacy / superseded → to be archived
Pre-migration docs still teaching the old model (root `MASTER.md`, `meta-take-architecture.md`, `START-HERE.md`, `SPEC.md`, all `mission-*.md`, root `HANDOFF-*.md`, `docs/STATE-2026-06-17.md`, `docs/RUNBOOK-bigbang.md`, and the entire **duplicate `filmcurio-bundle/`**). Pending your OK to move into `archive/` (BACKLOG §F).
- **공유·저장 시스템(기획)**: 루트 `HANDOFF-공유-저장-시스템.md` — ShareDock·채널전략·OG 이미지 표준·배치맵·측정. 구현 대기(다른 AI 수행 예정).
