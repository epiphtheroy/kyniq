# Metatake — DOC INDEX (start here)

*Map of the project's docs. Updated 2026-06-17 after the redesign sprint; ★-table refreshed 2026-07-06 (Tier-2 정본 등재). Read the "authoritative now" docs first; treat the rest as reference or history.*

> ⚠️ **Terminology (renamed 2026-07-12):** geographic map = **Locations** (`/locations`, was `/atlas`); connection graph = **Network** (`/network`, was `/map`; label still "Connections"). Old paths 308. Full mapping + what was KEPT: **`docs/RENAME-atlas-locations-map-network.md`**.

## ★ Authoritative now (read these)
| Doc | What it is |
|---|---|
| `docs/STATE-2026-06-17.md` | **Where we are** — live counts, entity model, pages, homepage, graph, Ask, migrations, RPCs, known gaps. The single source of truth for current state. |
| `docs/RUNBOOK-bigbang.md` | **How to add +405 films without mistakes** — the 3 pre-start blockers, pre-flight, safety rules, the exact ordered pipeline with commands/params/models/gotchas/verification/rollback. Use this for the next big bang. |
| `MASTER.md` | Original consolidation of logic + design + the 567-seed runbook. Still useful for concepts; its §4 *sequence* is superseded by RUNBOOK §3 and figure-page-KEPT §L.3 where they differ. |
| `docs/PLAN-tier2-almanac.md` | **Tier-2 5,041편 활용 정본 (2026-07-06)** — 3트랙 전략 + §7 실행 기록(Editor's digest·검색 v2·Full catalogue·credits·Atlas 핀 개방·slug 274 개명 전부 라이브). 남은 것: Track B 선별 색인(7/16)·Track C 엔진 웨이브. Tier-2/씬 콘텐츠 작업은 여기서 시작. `docs/REMEMBER-thin-content-gate.md`는 "숨김" 시절 기록으로 **대체됨**(자동 승격 트리거 ≥3 figures 메커니즘 설명만 여전히 유효). |

## Reference — current & accurate
| Doc | Purpose |
|---|---|
| `docs/HANDOFF-SEO-마스터.md` | **SEO 운영 정본 (2026-07-04, 갱신 07-07)** — sitemap **20분할**·코호트·IndexNow·slug_aliases/라우트 이전·Tier-2·CineCodex·**figure 질문 title 레이어**(§1 표·§3b-9)의 전 시스템 파일 위치 + 상황별 런북(새 영화/캡 증량/표면 개방/개명·이전) + 층별 정본 색인(§3b) + GSC 판독 로그. SEO 관련 변경 전 필독. |
| `OUTREACH-2주-실행플랜.md` + `OUTREACH-실행현황-2026-07-04.md` | **백링크 아웃리치 정본(플랜)과 실행 원장(현황)** — 복붙 초안(HN/Reddit/Substack/이메일)·타깃 리스트·금지사항 / Gmail 초안 18건·LibGuides 22곳 검증·매체 티어·휴면 타깃 기록. 발송 전 중복 확인은 현황 문서+Gmail 보낸함. 연락처 DB: `data/sources/magazine-contacts.csv`. |
| `GEO_운영-신규영화-증분처리.md` | **촬영지 파이프라인 상시 운영** — 새 영화 추가 시 이 문서 하나로 배치 추출→적재→지오코딩 자동 실행 (Claude Code에 붙이면 됨). |
| `HANDOFF-종합현황-지리촬영지.md` | 촬영지(film_locations) 파이프라인 이력·현황. §0 = 2026-07-03 완료 스냅샷(20,073행/4,334편), §12 = 수정·검증 로그. |
| `HANDOFF-아틀라스-SEO-읽는층.md` | 촬영지 데이터의 **SEO 읽는층**(2026-07-04 전 Phase 라이브: film/director locations 1,000+331 · 국가 73 · 도시 511) — 파일맵·DB RPC·불변식(게이트=mergeCells 동기 규칙)·신규영화 운영절차(§3). 설계·실행 로그는 `docs/PLAN-atlas-seo.md`. |
| `HANDOFF-계보-SEO-읽는층.md` | lineage(상·정전·국가별 정전·감독 계보)의 **SEO 읽는층**(2026-07-05~06: /lineage/[slug] 업그레이드 ~202 + /film/lineage/[slug] 신설 895 — Tier-2 367편 포함, 구 /film/x/honors 308) — 출처 표면화(코드맵+QID)·불변식(film_count 게이트 금지 등)·운영절차. |
| `SITE_LEDGER.md` (+ `handoff/`, `site_content/`) | **계보 데이터·점수·방법론 워크스트림 정본 (2026-07-06)** — 데이터 빌드(Wave1–12: `handoff/mappings/film_lineage.csv` 10k+행·`films_master.csv` 6.7k편)·DB상태(kyniq)·**선정기준(§1b)**·이번 수정(cine21 재라벨·ar-encuesta 숨김·award 인용 QID 20 보강)·미결·**월 1회 자동업데이트**. `handoff/00_MASTER_HANDOFF.md`=마스터 적재 인수인계, `site_content/METHODOLOGY_LINEAGE_SECTION.md`=/methodology 계보 섹션(선정기준 포함), `SEO_LINEAGE_SPEC.md`=JSON-LD/SEO 스펙. **계보 데이터·점수·방법론 변경은 여기서 시작**(프론트/SEO 읽는층은 위 `HANDOFF-계보-SEO-읽는층.md`). |
| `HANDOFF-연결엔진-커넥션.md` | **연결 엔진 정본 (2026-07-05; `/map`→`/network` 리네임 2026-07-12, 라벨은 여전히 "Connections")** — 친족(film_affinities, RRF)·counterpoint(entity_edges)·개념(concept_map)·갤럭시(film/director_map_xy)의 파일맵·데이터 객체·**불변식 6조**(meta_take_id 회귀 금지 등)·상황별 재실행 절차·인제스트 수요 큐(film_next_demand). movies-like/Connected/Counterpoints/**network**/galaxy 작업은 여기서 시작. `/api/map` 엔드포인트·`mapApi`/`mapFull` 키는 DB결합이라 유지. 진단·실행 이력: `docs/PLAN-connections-overhaul.md`. |
| `HANDOFF-트로프피겨아키타입-순위표면.md` | **트로프·피겨·아키타입 순위 표면 정본 (2026-07-05~06)** — /trope 멤버 라이브 랭킹(`trope_members_ranked`, take↔trope 코사인)·% match·리스티클 타이틀·ItemList/FAQ, 피겨 질문 H2+nearest figures(figure_neighbors), /catalog 순번·confidence %·날짜/EEAT, 필름 Tropes 독해제목 라인, /methodology#rankings. **함정 기록**: ftm.sim=트로프별 상수, 피겨 임베딩=표면축, reading 허브 0출판. 이 네 페이지 작업은 여기서 시작. |
| `HANDOFF-마이필름-렌즈.md` | **My Films 렌즈 정본 (2026-07-06, v1~v1.5 전부 라이브)** — 로그인 유저 seen 세트로 전 사이트를 off/highlight/only 3단으로 보는 클라 오버레이. LensProvider DOM 엔진(`a[href^=/film/]`+`data-lens-film`)·mine-first 정렬(CSS order)·LensQuickBar(12+페이지)·only-모드 데이터 스왑(readings/entities/takescore/films — `*_mine` RPC 8종은 **service_role 전용**, supabase/migrations/0042). **불변식**: 서버 HTML 개인화 금지(캐시·SEO), user_movies 로드 .range 페이징, 새 표면 옵트인 규약(.mtl-rows/.mtl-swap-out/data-lens-film). 렌즈·개인화 작업은 여기서 시작. |
| `HANDOFF-CRM-비즈니스접점엔진.md` | **CRM ("Touchpoint Engine") 구축 지시서 · 기획 정본 (2026-07-15, 구축 대기)** — `/crm`(admin과 분리) 오너 전용 아웃리치 CRM: 컨택 2,384행(검증 이메일 1,862) 임포트 → 세그먼트 66(클러스터 A–N)·오퍼 시드 41(상대 존재이유 결합형) → 스케줄링 룰(컨택이력 중심 초안 생성) → Gmail 연동 발송(수동 승인) → 룰베이스 자동응답 초안 → 서치 봇(scout·radar 브리지·수동 N레인). 마이그 0100/0101 DDL 전문·구축 순서 P0~P6·불변식 17조 포함. 컴플라이언스 캐논은 `Metatake_아웃리치_운영설계.md`, 세그먼트 원본은 admin doc `business-touchpoints`. CRM·아웃리치 시스템 작업은 여기서 시작. |
| `HANDOFF-왓투와치-스트리밍결정.md` | **What to Watch ("The Marquee") 기획 정본 (2026-07-12, 구축 대기)** — 구독-중심 시청 의사결정 메뉴(`/what-to-watch`, 나브 Wander·TakeScore 옆). Screener 엔진(`film_provider_index` 279k행·`cinecodex_ranked`) 재사용 + 신규 개념 3: VPN(다국가 `p_watch_countries`)·미국 도서관(Kanopy/Hoopla free)·rent/buy 뱃지(`fpi_rebuild` 확장). Where to watch(영화중심)와 대비되는 서비스중심. 구축 순서 P0~P4·불변식 12조. 부모 문서 `HANDOFF-테이크스코어-스크리너.md`. |
| `figure-page-KEPT.md` | Parking-lot + the most up-to-date pipeline notes: §G scale (1k-film), §H embeddings, §J tropes, §K scholar header, **§L the big-bang checklist**. |
| `meta-take-architecture.md` | The spine spec (entities, pipeline, decisions) — annotated with the 2026-06-14 figure-page reversal. |
| `figure-page-design.md` | Figure page + contribution spec; §6.6 output contract for figure-enrich. |
| `film-features-plan.md` | The 4 fixed film-hub sections (pitch/record/reception/experience) — peripheral to the figure→take pipeline. |
| `docs/metatake-about-v2.md` | The /about + manifesto copy (EN+KR), figure/take/meta-take/trope vocabulary. Source of truth for /about. |
| `docs/homepage-redesign-strategy.md` | Homepage design brief (3 concepts) — grounded in live RPCs. |
| `HANDOFF-home-v5-시안-가이드.md` | "Living Paper" home mockup handoff (the current homepage is its real-data adaptation). |
| `grounded-ask-design.md` | The Grounded Ask (RAG) design — implemented as /ask + /api/ask. |

## Legacy / historical (do NOT treat as current)
These describe the earlier **frames / single-call Q&A** product that the meta-take spine largely superseded. Keep for history; don't build from them.
- `SPEC.md`, `AGENTS.md`, `content-engine-overview.md`, `site-ia-plan.md` (frames IA), `figure-meaning-plan.md` (old terminology), `RUNBOOK-metatake.md` (first-build runbook), `prompt-featured-qa.md`, `frame-candidates.md`, `spoiler-guard-design.md`, the ~20 `mission-*.md` kickoffs, `redesign-*.md`, `prompt-design-changelog.md`.
- Strategy (non-pipeline, fine to keep): `Metatake_소개_매니페스토_제안.md`, `Metatake_아웃리치_운영설계.md`, `Metatake_자체LLM_타당성_전략검토.md`.

## Data / seed files
- `worker/theory_canon.csv` — Theories & Theorists canon (2,587 rows; loaded by `theory-import.py`).
- `data/seed/metatake_figures_takes_4662.csv` — original 567-film figures+takes seed (loaded by `mt-import.py`).
- `metatake_films_expansion_405.csv` — the +405 expansion list (**titles only, no tmdb_id**) → see RUNBOOK §0.A.

## Deploy/runner commands
`.command` files in repo root + `worker/` are double-click runners (sandbox can't push; the user runs them on their Mac). Deploy commands push to `main` → Vercel. Worker commands run the pipeline against the live DB. Naming: `deploy-*.command` (web), `run-*.command` (pipeline). The newest homepage deploy is `deploy-home-living2.command`.
