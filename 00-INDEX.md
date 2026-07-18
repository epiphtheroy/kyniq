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
| `HANDOFF-발견피드.md` | **발견 피드 "Discoveries" 정본·지침서 (2026-07-18 ✅P0+P1 구축·라이브검증·커밋 88e5201 브랜치 feat/discovery-feed·백그라운드 후순위)** — 신생 영화 사이트 자동 스캐너(WhoisDS 일배치+교정 사전 v2+Haiku 게이트, 월 ~$2.7 실측)→`/discoveries` 부정기 다이제스트. 첫 편=7일 백필 실측(49만 도메인→legit 23곳). 링크 2티어(Featured=dofollow·관측 로그=nofollow 자동)·§13 AS-BUILT·비활성 출하(크론 미설치·오너 개시 3단계)·§2 재논쟁 금지·dev 미리보기 `--webpack` 필수. 발견 피드 작업은 여기서 시작. |
| `HANDOFF-AI집필크레딧-표기개편.md` | **AI 집필 크레딧 표기 개편 정본·실행지침서 (2026-07-17 · ✅P1·P2 커밋 fff238b·P3 관찰창 대기)** — 🚨§10-bis: 사이트 중심 약속("발행 전 인간 검토")이 거짓으로 판명·라벨A에서 reviewed 삭제. — 전 표면 저작 표기를 "집필 Metatake AI · 설계·감독·감수 윤원우" 체계로 전환(749c35a 의도적 번복). 라벨 사전 4종(A/B/C/H)·오너 결정 D1~D8·methodology 선행 개정·표면별 파일:라인 작업표·to.W from-line·TakeScore 부제·외부배포 "human-curated" 7곳 수정·이름 전수(DB는 클린 확정)·롤아웃 P0~P5+GSC 가드. **크레딧·바이라인·AI 공개 표기 작업은 여기서 시작.** |
| `HANDOFF-배포체계-P0.md` | **배포체계 P0 정본 (2026-07-17 구축·라이브)** — "저장=즉시 프로덕션" 종료. 워처→staging 푸시·Vercel 개발 URL(프리뷰 보호)·CI 타입래칫(기준선 20, 올리기 금지)·**릴리즈=오너가 매일 22:00 `release.command` 더블클릭**(staging→main no-ff 병합). ⚠️main 직푸시 금지(핫픽스 예외)·DB는 프로덕션 공유(분리=미결②)·워처 staging 푸시는 force. 배포·릴리즈·CI 작업은 여기서 시작. |
| `HANDOFF-관측성-Sentry.md` | **Sentry 에러추적 정본 (2026-07-17 코드 완료·비활성 대기)** — errors-only 통합(@sentry/nextjs 10.66.0·파일 7개), env `NEXT_PUBLIC_SENTRY_DSN` 하나로 게이트(미설정=공식 no-op이라 배포 안전). 활성화=오너 3단계(§4: sentry.io 프로젝트→Vercel env→재배포). ⚠️Turbopack 함정: `sentry.client.config.ts` 금지(조용히 무시됨)·errors-only는 옵션 생략이지 0 설정 아님·withSentryConfig 없음=의도(소스맵은 §5 후속). 에러추적·관측성 작업은 여기서 시작. |
| `HANDOFF-DB백업-PITR.md` | **DB 백업 검증·복구 플레이북 정본 (2026-07-17 검증 완료)** — 실측: 일일 물리백업 8/8 COMPLETED(KST 06:25경·7일 보관·다운로드 불가). ⭐§3 단일테이블 무중단 복구="Restore to a New Project"→클론에서 pg_dump→라이브 주입(제자리 복원=전체롤백+다운타임이라 단일테이블 사고에 금지). PITR $100/월=보류 권고(§4, 재검토 트리거 명시). 남은 갭=오프플랫폼 로지컬 덤프(오너 DB비번 필요, §5). 백업·복구·데이터 유실 대응은 여기서 시작. |
| `HANDOFF-DB성능-인시던트.md` | **DB 성능 인시던트 정본 (2026-07-17 종결·후속 잔존)** — 소형 컴퓨트 포화 인시던트(백필 churn+배포 9회+/ko 크롤 중첩)의 원인·완료조치(VACUUM·마이그 0108 taxonomy HNSW **적용됨, 재적용 금지**·컴퓨트 Small 업그레이드)·⚠️미커밋 워킹트리 3파일·백필 재개 런북·백로그 P1~P5·재발방지 규칙 6조·진단 순서. **인프라/DB성능/검색성능 작업은 여기서 시작.** |
| `docs/HANDOFF-SEO-마스터.md` | **SEO 운영 정본 (2026-07-04, 갱신 07-07)** — sitemap **20분할**·코호트·IndexNow·slug_aliases/라우트 이전·Tier-2·CineCodex·**figure 질문 title 레이어**(§1 표·§3b-9)의 전 시스템 파일 위치 + 상황별 런북(새 영화/캡 증량/표면 개방/개명·이전) + 층별 정본 색인(§3b) + GSC 판독 로그. SEO 관련 변경 전 필독. |
| `HANDOFF-다국어프로젝션.md` | **다국어 프로젝션 정본 · 웨이브1(한국어) ✅ SHIPPED 라이브 2026-07-17 (커밋 `7e64d7f`)** — 영어 단일 정본 + `/{locale}` 얇은 셸 투영 체계(ko·ja·fr·es). 라이브: `lib/i18n/*` 코어·필름메인 `/ko/film/[slug]`·감독·촬영지·공유컴포넌트·마이그0105·TMDB ko백필·films-ko.xml·hreflang·네비 스위처·배너. **일본어·스페인어는 §-2 "새 언어 추가 7단계"로 착수**(구조변경 0). ⚠️지명/제목=번역 아니라 데이터(TMDB 백필+도시명)·감독/촬영지 noindex(혼합언어 §6.5)·`live:false→true`가 마지막·오너게이트=코어어휘 승인·마이그/백필/배포는 오너가 `!`로 실행. 롱폼 본문은 `HANDOFF-한국어화-i18n-마스터.md`(content_i18n). AS-BUILT: `Outputs/locale-projection-as-built.md`. **국제화·언어 사이트 작업은 여기서 시작.** |
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
| `HANDOFF-회사임원만들기.md` | **회사임원만들기 프로젝트 · AI 임원(직원) 조직 구축 지시서 · 기획 정본 (2026-07-15, 구현 대기 P0부터)** — 라이브된 /crm 위에 IR·BD/마케팅·HR "AI 직원" 3명을 얹는 조립 설계: AI 임원 1명 = 역할 플레이북 + 헤드리스 `claude -p` 세션(Mac 워처·구독 $0) + CRM DB 기억 + 일일 보고서. 핵심 발견 `crm_drafts.created_by='ai'` 기예약(스키마 변경 0)·발송/승격 경로 신설 0. 조직도(BD5/IR2/HR3 발송예산)·자율권 매트릭스 4등급·"스팸 같지 않게" 5요소(관련성 게이트·기브퍼스트·실명 발신 — 가공 페르소나 금지)·보고→컨펌→재개 루프(DECISIONS.md)·구축 순서 P0~P3·불변식 12조. 신설 코드는 `worker/agent-crm.py`+`agent-run.sh` 2파일뿐. AI 직원/에이전트 조직 작업은 여기서 시작. |
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
