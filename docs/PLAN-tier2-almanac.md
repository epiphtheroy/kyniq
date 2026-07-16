# PLAN — Tier-2 5,041편 활용 전략 (알마낙 개방 + 선별 색인 + 엔진 웨이브)

> 2026-07-05 작성. Supabase(kyniq) 실측 + 코드/문서 감사 기반.
> 선행 문서: `HANDOFF-SEO-마스터.md` §7(3층 구조), `PLAN-seo-surface-expansion.md`,
> `RUNBOOK-new-film-ingestion.md`, `REMEMBER-thin-content-gate.md`(※ 정책 변화로 일부 stale).
> 제약: 에세이 코퍼스 코호트는 별개 트랙(그대로 유지).
> **[UPDATE 2026-07-14] Track B(선별 색인 개방)는 SHIPPED** — `filmIndexBar`로 Tier-2 카탈로그 1,105편 색인 개방.
> → 실측·정본: `HANDOFF-SEO-스타터가이드-작업지시서.md §2` / `lib/seo.ts filmIndexBar` (마이그 0097 `film_index_signals_json`).

---

## 1. 실측 현황 (2026-07-05 SQL 기준)

전체 6,975편 = **Tier-1 1,934편**(approved figures ≥3, visible, 색인) + **Tier-2 5,041편**(noindex, hold 4,760).

Tier-2 5,041편이 실제 보유한 데이터:

| 데이터 | 보유 편수 | 비고 |
|---|---|---|
| overview / poster | 5,022 / 4,990 | TMDB(신디케이트) |
| film_ratings | 4,733 | IMDb ≥10k votes **1,152편**, ≥1k 2,942편 |
| film_scores (prestige/discovery) | 4,751 | 공개 표면 미렌더 — /me 개인화 RPC(me_watched_scored 등)에서만 사용 |
| cinecodex_confidence (tier) | 4,767 | Tier-2 페이지에 이미 렌더 |
| film_watch_providers (비어있지 않음) | 3,805 | |
| film_lineage (정전 리스트 계보) | 4,751 | 중앙값 1리스트, ≥3리스트 367편 |
| film_locations | 2,511 | **≥3핀 1,194편** = FILM_LOCATIONS_MIN 충족, Tier-2 페이지엔 미렌더 |
| film_next 인바운드(추천받음) | 995 | **편집 산문 이유(reason) 포함** — 고유 콘텐츠, ≥2건 569편 |
| film_reception / essays | 21 / 3 | 사실상 없음 |

**고유 모듈 티어링** (계보 ≥2리스트 / 인바운드 추천 / 위치 ≥3핀, 세 모듈 기준):
- 모듈 ≥2개: **827편** (그중 IMDb ≥10k votes: **563편**)
- 모듈 1개: 1,332편 · 모듈 0개: 2,882편

위생 문제: stub slug(`tmdb-*`) **274편**, director_slug 보유 **22편뿐**(감독 페이지는 이름
문자열 매칭으로 보완 중 — 표기 변형에 취약).

## 2. 진단 — 무엇이 문제이고 무엇은 이미 해결됐나

**이미 잘 되어 있는 것 (오해 금지):**
- Tier-2 전용 카탈로그 템플릿 완비(히어로·About·CineCodex·계보·추천받음·크레딧·시청처)
  + noindex,follow + "not yet read closely" 크롤러블 퍼널(감독/장르/계보/무브먼트). 안전한 구조.
- **자동 승격 완전 자동화**: figures ≥3 → DB 트리거 `visible=true` → 색인·사이트맵·모듈 전부
  자동 편입. 수동 작업 없음.

**실제 갭 (이번 플랜의 대상):**
1. **이용자가 Tier-2를 찾을 수 없다** — `search_site`·`films_catalogue`·`home_pool`·
   `random_film_slug`·`seq_nav` RPC 전부 `visible` 필터. 사이트 내 검색으로 5,041편이
   안 나옴. "모든 콘텐츠를 이용자가 즐긴다" 목표의 최대 구멍. (noindex와 사이트 내 검색은
   무관 — SEO 리스크 0으로 즉시 풀 수 있음.)
2. **보유 데이터가 페이지에 안 실린다** — film_scores 4,751편 미사용, 위치 데이터 1,194편
   미사용(Atlas 모듈이 full 분기에만 있음), 계보 리본에 rank/edition 미표기.
3. **색인 개방(Layer 3)** — ✅ **SHIPPED 2026-07-14**: `filmIndexBar`로 Tier-2 카탈로그 **1,105편**(is_analyzed=false)이 noindex→색인 개방(색인 필름 메인 1,959→~3,064). → 실측·정본: `HANDOFF-SEO-스타터가이드-작업지시서.md §2` / `lib/seo.ts filmIndexBar`.
4. 위생: stub slug 274, director_slug 백필.

## 3. 전략 — 3트랙

### Track A — 이용자 전면 개방 (SEO 무관, 동결과 무관, 즉시 가능)
1. **사이트 내 검색에 Tier-2 포함**: `search_site` RPC 수정 — Tier-2는 하위 랭크 + 결과에
   "카탈로그" 뱃지. (RPC는 라이브 DB에만 있음 — RUNBOOK 경고대로 버전 관리 주의.)
2. **/film 카탈로그에 전체 보기**: 기본은 지금처럼 Tier-1, "전체 카탈로그 6,975" 토글/탭 추가.
3. **Tier-2 페이지 모듈 추가 (전부 기존 데이터, LLM 비용 0):**
   - film_scores 모듈(prestige/discovery) — 죽은 데이터 활성화
   - Atlas 미니맵(위치 ≥3핀 1,194편) + /atlas 링크
   - 계보 리본 강화: rank·edition·tier 뱃지 (film_lineage.rank/facet 이미 있음)
4. **위생**: stub slug 274 → 정상 slug 재생성 + `slug_aliases` 308 등록; director_slug 백필
   (TMDB credits 기준) → 감독 페이지 이름 매칭 의존 제거.

#### A+. 집계 표면 4종 (2026-07-05 추가 실사 — 색인은 집계 페이지가 받고 Tier-2는 퍼널)
- **Atlas**: atlas/geo RPC 전부(`atlas_country_json`, `geo_overview_json`, `atlas_city_candidates_json`,
  `country_geo`, `director_geo` 등) `visible` 필터 → Tier-2 2,511편의 핀이 지도에서 통째로 빠짐.
  필터 완화 시 국가/도시 페이지(색인됨)가 즉시 풍부해짐. 단 도시 멤버십 규칙은 RPC SQL과
  동기 필수. ※ 개별 영화용 `film_geo`는 필터 없음 — Tier-2 페이지 미니맵은 렌더만 추가하면 됨.
- **TakeScore/CineCodex — 두 시스템 구분**: CineCodex conf는 테이크 증거 기반이라 Tier-2는
  구조적으로 Limited(4,763편) → /takescore 리더보드(`cinecodex_ranked` top500) 활용 불가.
  이건 정직한 설계이므로 유지. 반면 **film_scores**(prestige/discovery 4,751편)는 /me RPC에서만
  사용 — Tier-2 페이지 모듈 + "discovery 발굴 랭킹" 류 공개 집계 페이지 신설 여지.
- **Credits 인물 페이지**: 필모그래피는 TMDB person credits로 만들고 `catalogFilms()`가
  `visible=true`만 내부 링크로 승격(`app/credits/[person]/page.tsx:84`) → Tier-2 작품은 무링크
  텍스트로 격하. 필터 완화(+카탈로그 뱃지)만으로 색인되는 인물 페이지가 풍부해지고 Tier-2로의
  내부 링크 대량 확보. 데이터 백필 불필요.
- **Where-to-watch**: Tier-2 3,805편이 시청 데이터 보유. `/whereto/[slug]`는 **게이트가 아예
  없음**(visible 필터도 robots 게이트도 없음 → 크롤러가 발견하면 색인되는 우연적 상태 — 명시적
  정책으로 정리 필요). 사이트맵 광고는 visible+데이터만. 제안: Tier-2 whereto는 "시청 데이터
  + 고유 모듈 ≥1" 조건부로 Track B 때 whereto.xml 편입, 그 전엔 크롤러블-비광고 유지.

### Track B — 선별적 색인 개방 (Layer 3) — ✅ SHIPPED 2026-07-14
> **[UPDATE 2026-07-14] 실제 출시가 아래 제안을 대체(SUPERSEDED).** 게이트는 `almanac_bar(모듈 ≥2)`가 아니라
> `lib/seo.ts filmIndexBar` = (film_reception≥3 OR film_lineage≥3 OR film_wd_honors≥3) AND film_provider_index≥1
> AND slug NOT LIKE 'tmdb-%'; 코호트는 별도 `films2.xml`이 **아니라** 메인 films 사이트맵에 편입
> (INDEX_COHORT_FILMS_T2=300); 개방 편수 **1,105편**(색인 필름 메인 1,959→~3,064). `hold`는 게이트 입력 아님·
> `visible≠indexable`(승격된 Tier-2는 visible=false지만 indexable). → 실측·정본: `HANDOFF-SEO-스타터가이드-작업지시서.md §2`
> / `lib/seo.ts filmIndexBar` + 마이그 0097 `film_index_signals_json`. 아래는 원 제안(이력 보존).
- **원칙**: 신디케이트 데이터(TMDB overview·평점·시청처)만 있는 페이지는 영구 noindex.
  **고유 부가가치**(정전 계보 큐레이션 + 편집 추천 이유 + 자체 지리 데이터)가 있는 페이지만 개방.
- **1차 코호트**: 모듈 ≥2 & IMDb ≥10k votes = 563편 중 **~500편** (수요 + 차별화 교집합).
- **방법**: `meetsBar` 확장 — `figures ≥3 OR almanac_bar(모듈 ≥2)`; 기존에 보류해 둔
  `films2.xml`(HANDOFF-SEO §7) 신설로 기존 films.xml 코호트와 분리 계측; GSC로 색인률·
  노출·품질 신호 관찰 → 이상 없으면 모듈 ≥2 나머지(~300편) → 모듈 1 + 수요 순으로 확대.
- **롤백**: 코호트 단위로 noindex 복귀 가능하게 플래그(예: `films.index_cohort`)로 관리.

### Track C — 엔진 웨이브 (진짜 채우기: Tier-2 → Tier-1 승격)
- 승격 체인은 이미 완비: `film-extract-batch.py`(Opus, Batch API) → bold-take → embed →
  trope-incremental… → figures ≥3 → 트리거가 알아서 개방.
- **우선순위 큐**(웨이브당 500~1,000편):
  ① 인바운드 추천 타깃 995편(Tier-1 페이지가 이미 링크·추천 이유까지 써 둠 — 연결 완성 가치 최대)
  ② T1 계보 리스트(TSPDT 등) 소속 미분석작 ③ IMDb ≥10k votes ④ (개방 후) GSC 수요 신호.
- **비용**: 파일럿 30편 실측 후 확정(기존 컨벤션). 선례 — geo $0.05~0.12/편,
  naming $145/1,900편. extract는 출력이 커서 편당 수십 센트 예상 → 5,000편 전량은 수천 달러
  규모일 수 있음. 웨이브 분할 + 실측 필수.
- **금지**: "채워 보이게" 하려고 Tier-2 전체에 대량 산문 생성 금지 — scaled content abuse
  리스크이자 엔진 원칙(quality > volume, `content-engine-overview.md` §6) 위반.
  채움은 엔진 품질 그대로, 우선순위 순서로만.

## 4. 가드레일
- 품질 신호는 **사이트 전역** 판정 — 색인 개방은 반드시 코호트 단위 + GSC 계측 + 롤백 플래그.
- Tier-2 알마낙 템플릿과 Tier-1 분석 템플릿의 구조적 차이 유지(도어웨이 중복 인상 방지).
- 라이브 감사는 캐시버스터 필수(`live-audit-isr-cache-trap` 교훈).
- `REMEMBER-thin-content-gate.md`는 stale — "숨김" 정책이 "noindex 퍼널 노출"로 바뀐 현실
  반영해 갱신(또는 본 문서로 대체 후 정리).

## 5. 실행 순서 제안
1. **지금**: Track A 전부 (검색 포함 → 모듈 추가 → 위생). 동결과 무관.
2. **7/16 리뷰**: 기존 코호트 GSC 판독과 함께 Track B 1차 코호트(~500편) 개방 결정.
3. **병행**: Track C 웨이브 1(인바운드 타깃 995편 중 파일럿 30 → 실측 → 웨이브).
4. 웨이브가 돌수록 Tier-2 자체가 줄어듦 — Track B는 "엔진이 아직 못 간 곳"의 임시 다리.

## 6. 원우 결정 필요
- [x] Track A 검색 노출 라벨 → "catalog" 칩(.t2-chip)으로 실행됨 (2026-07-06)
- [x] Track B 선별 색인 개방 → **SHIPPED 2026-07-14**: `filmIndexBar` 게이트로 1,105편 개방, 코호트는 메인 films.xml 편입(films2.xml 미채택). → `HANDOFF-SEO-스타터가이드-작업지시서.md §2`
- [ ] Track C 웨이브 1 예산 상한(파일럿 실측 후 승인)

## 7. 실행 기록 — Track A + A+ 전체 출시 (2026-07-06)

**코드(커밋 548cefe 배치, 라이브 검증 완료):**
- Tier-2 페이지 **Editor's digest** 신설 — About 대신 리드. DB 숫자·텍스트 결정론 조합
  (정전 하이라이트 ≤3 선별, 인바운드 추천 이유 1건 원문 인용 "— Metatake Editorial",
  평점·지리·시청권역·Prestige/Discovery 칩). 바이라인 "Edited by Wonwoo Yoon"(→/editor) +
  Record updated = 소스 행 타임스탬프 최대값(오늘 날짜·백데이트 금지). WebPage JSON-LD
  (dateModified + editor Person @id). About은 하단으로 격하. 캐시 키 film-load4→**film-load5**.
- Tier-2 페이지 **Atlas 미니맵**(film_geo, 기존 FilmMap 재사용), film_scores는 digest 칩으로 렌더.
- `/film` **Full catalogue 뷰**(?view=all, 120/페이지, 직접 쿼리), 검색 UI(is_catalog→"catalog" 칩,
  SearchBox+`/search`), credits 인물 페이지 Tier-2 링크 승격(+칩, noindex 바는 read≥3 유지),
  `/whereto/[slug]` robots 게이트 명시(visible만 색인), `/film/[slug]` **resolveAlias 폴백** 추가,
  `/api/geo` 핀 한도 30,000.
- 공용 칩 스타일 `.t2-chip`(globals.css).

**DB(마이그레이션·전부 원우 승인 후 적용):**
- M1 director_slug 백필: Tier-2 22→**1,022편** (무모호 868명 정확 일치).
- M2 `search_site` v2(migration search_site_v2_tier2_catalog): Tier-2 포함, is_catalog 컬럼,
  0.8 디스카운트+동점 Tier-1 우선. 검증: "paper moon"→Paper Moon(1973) 카탈로그 1위.
- M3 Atlas 표시 개방(migration atlas_display_include_tier2_pins): geo_overview/bbox/sample·
  country_geo·atlas_country_json에서 visible 제거(+films 배열에 visible 키). 자격 게이트 불변.
  검증: 전체 핀 25,029 · 한국 119편(Tier-2 +52).
- M4 stub slug **274편 전량 개명** + slug_aliases 548건(/film·/whereto, 308 동작 확인).

**남은 것:** ~~Track B(선별 색인)~~ → ✅ **SHIPPED 2026-07-14**(filmIndexBar, 1,105편 — → `HANDOFF-SEO-스타터가이드-작업지시서.md §2`), Track C(엔진 웨이브 — 1순위 인바운드 타깃 995편 파일럿 30),
atlas_country_json의 visible 키를 쓰는 국가 페이지 UI 뱃지(선택), lineage_editions 노출(계보 세션 카드).

**[UPDATE 2026-07-16] 필름 세부페이지 실질성 보강 (정본: 루트 `HANDOFF-필름페이지-보강-작업지시서.md`, 기획 완료·구현 대기)**
- 14항목 계획이 이 문서의 **Editor's digest 기법**(DB 행 위 영화별 결정론 문장 조립, LLM-0)을 단일 digest에서 **모든 섹션 리드**(#5/#6 TakeScore·#8 Lineage·#9 Sources·#11 Locations·#13 Where-to-watch)로 확장한다.
- Track A "모듈 추가" 항목의 후계: `film_scores`→#5/#6 TakeScore 리드, Atlas 미니맵→#11 Locations 리드, 그리고 위 "남은 것"의 **`lineage_editions` 노출(계보 세션 카드)** 미결 항목 = **#9 "Sources for this record" 박스로 배달**(Origin/Awards/Canon 출처별 그룹 + 건수 + "Record updated").
- **render-only**: 색인/robots/사이트맵 불변, 신규 페치·LLM 비용 0. 캐시키는 렌더 변경 시에만 `film-load8`(shape 무변경이면 범프 불요).
