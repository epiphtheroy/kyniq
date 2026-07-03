# /room — 로직 감사 · 보강 마스터 (개정 정본)

> **목적**: /room(다크 "운영시스템 셸") 전 섹션의 뒷단 로직·데이터 배선·링크·개인정보 흐름을
> 섹션별로 감사하여 — 충분한 로직은 **확정·잠금(LOCK)**, 부족·모호한 것은 **무엇이/왜/어떻게 보강**할지를 못박는다.
> 이 문서는 앞으로 계속 **개정**한다. 항목 상태가 바뀌면 해당 줄과 §9 개정 로그를 갱신할 것.
>
> **검증 방법**: 앱 코드(파일:라인) + **라이브 Supabase DB**(`jvgarcqrtsmgfimdcwgo`)에서 `pg_proc`·`pg_policies`·security advisor·행수 직접 조회. 4개 병렬 감사 에이전트 교차 + 저자 재검증.
> **최초 작성**: 2026-07-01 · **관련 문서**: `HTML-DESIGN-HANDOFF.md`(디자인 의도) · `PLAN-room-implementation.md`(빌드 계획, 일부 낡음) · `SHARED-STANDARD.md`(S1–S11) · `docs/logic/`(9엔진).
>
> **상태 범례**: ✅ 확정·잠금 · ⚠️ 부족·모호 · ❌ 미구현(정직한 빈 상태) · 🔒 개인정보 · 🗺️ 지도호출 · 🔗 커넥션호출

---

## 0. 총괄 판정 (Executive)

**잘 지켜진 것 (실측으로 확인 — 유지·잠금):**
- **Cinecodex 비섞임(never-blend)**: 우리(V/C/R/U/S) · 외부(imdb/rt/meta) · 정전가(prestige)를 물리적으로 분리 렌더. EvalCard 트립티크·CinecodexCard `.sbs` 모두 3칸 분리, "절대 한 숫자로 합치지 않는다" 명시. **위반 없음.**
- **NAV 단조성**: `me_portfolio_nav = 100·(1−0.5^(pd/1.4))`, pd=관람작 prestige의 감쇠합(비음수항만 가산) → 관람은 NAV를 올리기만 함. **원천 공식에서 성립.**
- **색 토큰 분리**: `--risk #D64518`(위험 R) ≠ `--conquer/--red #E3120B`(완파/정복). 위험 요소 전부 `--risk`만 사용, 오용 사례 0.
- **개인정보 스코핑**: 개인 데이터 RPC 17종 전부 `SECURITY DEFINER` + `auth.uid()` 자기필터(실측). 기본 `visibility='private'`(공개 0행). 공개 프로필은 13서브·신뢰도·prompt_sha·개별평점·취향벡터 **미노출** 확인. **타 유저 데이터 누출 경로 없음.**
- **정직한 빈 상태(no-fake-data)**: 데이터 부족분은 "형성 중"(gold)·정직 empty로 처리. 지어낸 숫자는 (아래 예외 몇 개를 빼면) 없음.

**최우선 갭 5개 (P0):**
1. **⑦커버리지·④블라인드 전용 RPC 부재** — `me_coverage`·`me_blindspots`가 **DB에 실제로 없음**(실측). 두 기능이 `portfolio_breakdown.canon`(facet=canon·film_count≥90·상위 8개)에서 파생 → 커버리지 %가 구조적으로 저평가, 블라인드는 8개 대형정전 안에서만 검출. **커맨드센터+분석 공유 결함.**
2. **5전략 중 conquer·gap 영구 공백** — `me_recommend_wwi.reasons`가 `conquer`를 절대 방출 안 함, `gap`은 `discovery≥55` 프록시(진짜 블라인드 아님). 데스크 2개 전략 컬럼 구조적 사망.
3. **쓰기(write) 경로 미배선** — watchlist/desk의 담기·봤어요·관심없음, 서재 공개토글·즐겨찾기, 노트 저장·게시가 **전부 로컬 세션 상태**(DB 미반영). 새로고침 시 소실. (예외: `/room/rate`의 별점은 `rate_film` **실제 mutation**.)
4. **셸 티커/시스템상태 카드 하드코딩** — `6,701편`·`v2-fixA`·`Vertigo 84.5`가 정적 리터럴(6,701은 지금은 우연히 실제와 일치하나 갱신 안 됨). no-fake-data 소프트 위반.
5. **동행(커넥션)=완전 스텁** — 파트너/매칭/초대/동의 테이블이 **하나도 없음**. `me_pair_state`는 "나 외 loved≥1 유저 수 COUNT"만 반환 → "동행 상대" KPI 오해 소지. 싱크율 계산 미존재.

**구조적 위험 (P1):**
- **버전관리 갭**: room RPC **20종 전부 마이그레이션 파일에 없음**(DB에 out-of-band 직접 생성). 리뷰·롤백·재현 불가.
- **`/api/geo` 무스코프·무레이트리밋** + `film_locations`/`geo_cache` RLS 정책 0개(default-deny·미문서화) + `FilmMap`(필름/감독 탭) 외부 타일 IP 노출.
- **`/u/me` 자기 공개프로필 링크 404**(username="me" 미해석).

### 상태 대시보드

| 섹션 | 로직 충분성 | 개인정보 | 핵심 결함 |
|---|---|---|---|
| 현황·커맨드센터 | ⚠️ | ✅ | ⑦④ 파생 결함 · conquer 미방출 · 티커 하드코딩 |
| 보유·컬렉션 | ✅ (경미 ⚠️) | ✅ | "최근순" 데드 · 발견=`—` 고정 |
| 볼영화·워치리스트 | ⚠️ | ✅ | 담기/봤어요 로컬만 · conquer 미방출 |
| 운용 데스크 | ⚠️❌ | ✅ | conquer/gap 공백 · 자산곡선 미구현 · summary 필드 낭비 |
| 자산 분석 | ⚠️ | ✅ (최민감) | 축커버리지 ⑦종속 · maturity/films 미소비 |
| 지리 Atlas | ✅ (⚠️ 파생) | ✅ 🗺️최적 | 대륙매핑 하드코딩 · 점 미중복제거 · REF=50 |
| 감독 정복 | ✅ | ✅ | "전 작품 정복" 카피 과장(=DB커버리지) |
| 촬영지 허브 | ✅ | ✅ | 좌표 텍스트만(미니맵 없음) |
| geo API / FilmMap | ⚠️ | 🗺️ IP노출 | 무레이트리밋 · 외부타일 · geo_cache 미가동 |
| 기록·평가 | ✅ | ✅ | (rate_film 실mutation — 양호) |
| 서재 | ⚠️ | ✅ | 공개토글·즐겨찾기 로컬만 |
| 노트·글쓰기 | ❌ | ✅ | 저장·게시 로컬만 · HTML sanitize 필요(향후) |
| 동행(커넥션) | ❌ | ✅(현재무해) 🔗 | 파트너/매칭/동의 테이블 전무 |
| 공개 프로필 | ✅ | ✅ | `/u/me` 링크 404 |
| 셸/평가카드 | ✅ (⚠️티커) | ✅ | 티커·시스템카드 하드코딩 · per-film 산문 미구현 |

---

## 1. 전역 불변식 (LOCKED — 어기면 로직 약속 위반)

각 항목은 실측으로 현재 준수 확인됨. **신규 코드/RPC도 반드시 준수.**

1. **비섞임 나란히**: Cinecodex · 외부 · 정전가는 절대 한 숫자로 합치지 않는다. 항상 분리 칸.
2. **위험색 분리**: 위험 R = `--risk`(#D64518). 완파/정복 = `--conquer`/`--red`(#E3120B). 재사용 금지. (`--conquer`와 `--red`가 같은 값인 것은 허용 — 금지 조합은 risk↔conquer.)
3. **NAV 단조**: 관람은 NAV를 깎지 않는다(포화·감쇠만). 신규 NAV 관련 로직(예: 자산곡선)은 단조 어서션을 포함할 것.
4. **설명가능 인스펙터**: 무엇을 클릭하든 우측 인스펙터가 "상세 + 왜 이 값"으로 스왑.
5. **실 숫자만**: 하드코딩 금지. 부족분은 "형성 중"/정직 empty. (현재 위반: 셸 티커/시스템카드 — §2.15, P0.)
6. **DB 가산(additive)**: 공개 테이블 불변. 개인/룸 데이터는 `auth.uid()` 스코프 DEFINER RPC로만. 신규 개인 데이터 write는 RPC 레벨에서 스코핑 강제(프론트 신뢰 금지).
7. **공개 프로필 금지 항목**: 13서브·신뢰도·prompt_sha·개별평점·취향벡터는 다크 셸 전용. 공개 노출 금지.

---

## 2. 섹션별 감사

각 섹션: **역할 / 데이터체인 / ✅확정(잠금) / ⚠️부족·모호 / 🔧보강안 / 🔒개인정보.**

### 2.1 현황 · 커맨드센터 (`/room` · `CommandCenterWorkspace.tsx`)
- **역할**: 영화 자산 하루 대시보드 — NAV 히어로 · 오늘의 한 편 · KPI · 커버리지 매트릭스 · 블라인드 · WWI 데스크 · 별자리.
- **데이터체인**: `page.tsx` `Promise.all` → `me_portfolio_nav()`·`portfolio_breakdown()`·`me_recommend_wwi(1.0,12)`·`me_taste_neighbors(12)`·`me_collection()`. `discovery` 평균은 서버 계산. 링크 → 인스펙터 `/room/film/{slug}`.
- **✅ 확정(잠금)**:
  - NAV 히어로·4성분바·오늘의한편(최대 Δ)·WWI 행·별자리 전부 실 RPC 값. `<8`편이면 `nav=null` → "형성 중"(정직).
  - WWI = `100·conf·(0.45u+0.35t+0.20s)`, Δ = 한계 NAV 기여(NAV 동일 감쇠-포화식). loved centroid 코사인 `sim`. 전부 SQL 실계산.
  - avail = KR flatrate 실조회, 없으면 "미확인 ≠ 안 됨". 색 토큰 분리 준수.
- **⚠️ 부족·모호**:
  - **커버리지 매트릭스(⑦)·블라인드(④)가 전용 RPC 없이 `portfolio_breakdown.canon`(facet=canon·film_count≥90·limit 8)에서 파생.** 결과: (a) "전체 커버리지 %"가 8개 대형목록 기준이라 구조적 저평가, (b) 블라인드가 그 8개 안에서만 검출(award/national/festival·89편 정전은 절대 안 뜸), (c) KPI "계보 라인"(전 facet distinct)과 매트릭스(canon 8)가 서로 다른 우주를 셈 → 사용자 혼동.
  - **WWI `conquer` 이유 원천 미방출**, `gap`도 `discovery≥55` 프록시 → conquer 칩 항상 빔.
  - Discovery 임계 20, 기타 판정 문구는 클라 하드코딩(UI 정책).
- **🔧 보강안 (P0)**:
  - `me_coverage()` 신설 — 반환 `list_id,label,facet,seen,total,pct,state('lock<50/prog50-74/near75-99/done100')`. facet·가중 파라미터, `film_count` 하한 제거/파라미터화.
  - `me_blindspots()` 신설 — 반환 `label,facet,total,seen,ratio,gap_reason`. 전 facet, seen=0 정렬.
  - `me_recommend_wwi`에 `conquer` 이유 추가(위 RPC 조인: "이 후보가 특정 계보 완파를 진척?"), `gap`을 blindspot 조인으로 재정의.
  - 두 RPC + 기존 20종을 **마이그레이션으로 커밋**(§6).
- **🔒 개인정보**: 개인 관람·평점·취향벡터. `auth.uid()` DEFINER 스코프(실측). 신규 RPC도 동일 강제.

### 2.2 보유 영화 · 컬렉션 (`/room/collection` · `CollectionWorkspace.tsx`)
- **역할**: 보유작 자산 테이블 — 정전가(시장가) + Cinecodex(V/U) 나란히 + 2축 가치뱃지.
- **데이터체인**: `me_collection()` → `prestige,discovery,rating,v,c,r,u,conf,tier,imdb,rt,meta,votes,facets,added_at`. 인스펙터 CinecodexCard → `/room/film/{slug}`.
- **✅ 확정(잠금)**: 반환 필드 ↔ 소비 1:1. never-blend 준수(정전가/V·U/외부 각 분리 칼럼). 가치뱃지 2축 = `별점−정전가`(시장합치)·`별점−V`(분석합치) 각각 차익. 미평가 정직(`·`/unrated).
- **⚠️ 부족·모호**: (a) 정렬 "recent"가 데드 — `added_at`을 RPC가 주는데 세그 버튼(score/rating/gap)에 없고 분기도 없음. (b) CinecodexCard 정전 칼럼 "발견"이 하드코딩 `"—"`. (c) 뱃지 임계(+12/−9)는 클라 상수(문서화 필요).
- **🔧 보강안 (P2)**: "최근순" 세그 + `added_at desc` 케이스 구현. "발견"에 `discovery` 배선 or 라벨 제거. 임계 상수 모듈화·주석.
- **🔒 개인정보**: 개인 별점·관람. `auth.uid()` 스코프. 특이 노출 없음.

### 2.3 볼 영화 · 워치리스트 (`/room/watchlist` · `WatchlistWorkspace.tsx`)
- **역할**: 매수 후보 데스크 — WWI 적합도 + 위험(R) 필터 + λ 다이얼.
- **데이터체인**: `me_recommend_wwi(1.0,40)` → `wwi,u_util,t_taste,s_standing,sim,v,r,conf,tier,prestige,disc,delta,reasons,avail`. 인스펙터 → `/room/film/{slug}`.
- **✅ 확정(잠금)**: 후보 풀 실 RPC. loved<3이면 SQL 빈 결과 → "≥3편 필요"(정직). **λ 재계산이 원천 공식과 동일**(`u01=clamp((v−λr)/100)`) → 슬라이드 재정렬이 서버 로직의 정직한 재현. 위험색 분리·avail 정직.
- **⚠️ 부족·모호**: **담기/봤어요/관심없음이 로컬 `Set`만 — DB 미기록**(새로고침 소실, `user_movies` 미반영). 인스펙터 버튼도 핸들러 없음(장식). `conf ?? 40` 폴백이 실측 40인지 기본값인지 UI 구분 불가. conquer 미방출.
- **🔧 보강안 (P0)**: 담기/봤어요/관심없음을 mutation RPC `me_set_watchlist(slug,bool)`·`me_mark_seen(slug)`로 배선(낙관적 UI). 인스펙터 버튼 동일 연결. `conf` 미측정 표기 구분.
- **🔒 개인정보**: 취향벡터 기반 추천. `auth.uid()` 스코프. 현재는 write 미배선이라 기록 누락이 문제(누출 아님).

### 2.4 운용 데스크 · Asset Desk (`/room/desk` · `DeskWorkspace.tsx`)
- **역할**: 다음 한 편 5-전략 보드(safe/frontier/conquer/gap/canon) + P&L(적중/regret) + 고위험 경고 + 자산곡선.
- **데이터체인**: `me_recommend_wwi(1.0,48)`·`me_watched_scored()`·`me_takescore_summary()`.
- **✅ 확정(잠금)**: P&L 실측(hits=★3.5+, regrets=★≤2.0, hitRate, avgRating). **NAV 불변 서사 정합**("관람은 NAV 깎지 않음" 반복). 자산곡선 정직 empty(가짜 궤적 안 그림). 5전략 버킷 실 reasons 기반. 색 분리·각주("완파 red ≠ 위험 orange") 준수.
- **⚠️ 부족·모호**: (a) **conquer·gap 컬럼 영구 공백**(reasons 미방출·프록시). 정직 empty이나 5전략 중 2개 사망. (b) `me_takescore_summary`의 `best/riskiest/median_ts/value_gap` 반환하나 UI가 `avg_v/avg_r`만 씀(낭비). (c) **자산곡선 = nav-snapshot 테이블 없음 → 영구 부재**. (d) 액션버튼 핸들러 없음. (e) 임계(R≥29, regret −1) 클라 상수.
- **🔧 보강안**:
  - (P1) `nav_snapshots(user_id,ts,nav)` 테이블 + RLS(user_id=auth.uid()) + 일일 스냅샷 잡 + `me_nav_history()` RPC → 자산곡선 실렌더(단조 어서션).
  - (P0) conquer/gap을 `me_coverage`/`me_blindspots` 조인으로 실태깅(§2.1과 공유).
  - (P2) summary best/riskiest를 KPI/인스펙터 배선 or 반환 축소. 액션버튼 mutation 배선(§2.3 공유).
- **🔒 개인정보**: 관람이력·별점·regret(취향 실패 노출 민감). `auth.uid()` 스코프. 스냅샷 테이블 신설 시 RLS 필수.

### 2.5 자산 분석 (`/room/analysis` · `AnalysisWorkspace.tsx`)
- **역할**: 취향벡터 소비 → 시그니처 앵커·렌즈분포·μ–σ 위험평면·형상 클라우드·축커버리지·상호추천.
- **데이터체인**: `me_taste_signature(8)`·`portfolio_breakdown()`·`me_collection()`·`me_figure_cloud(28)`·`me_taste_neighbors(8)`. 형상칩 → `/trope/{slug}`(라우트 실재), 카드 → `/room/film/{slug}`.
- **✅ 확정(잠금)**: 산점도 좌표 전부 실 collection 값 파생(centroid=μ, σ_R 실계산). **never-blend 강조 각주**("V=(COG+AFF+FORM+MORAL+DUR)/5 · 정전가·외부는 입력 아님"). 표본 부족 정직 empty. 위험색 스코프드.
- **⚠️ 부족·모호**: (a) 축 커버리지가 커맨드센터와 동일 `portfolio_breakdown.canon`(8개) 종속(⑦ 결함 공유). (b) `me_taste_signature.films` 카운트 의미 미노출(anchor vs lineage 산식 다를 수 있음, 라벨 없음). (c) `me_figure_cloud.maturity` 미소비. (d) 히어로 분모 `watched/50`·VR 임계 클라 상수.
- **🔧 보강안 (P0/P2)**: 축커버리지를 `me_coverage()`로 교체. signature films 산식 툴팁·RPC 마이그레이션 커밋해 검증가능화. maturity를 형상칩 신뢰도에 배선 or 반환 축소.
- **🔒 개인정보**: **가장 민감** — 취향 centroid·loved 목록·해석 앵커(심리 프로파일). `auth.uid()` DEFINER. 향후 공유/URL 노출 기능 추가 시 스코프 재검토. 현재 본인 세션 한정 적정.

### 2.6 지리 Atlas (`/room/atlas` · `AtlasWorkspace.tsx`) 🗺️
- **역할**: 본(seen) 영화 촬영지·무대 좌표를 손수 그린 등거리원통도법 SVG 세계지도에 표시 + 국가별 커버리지 + 지리 블라인드(④).
- **데이터체인**: `me_geo_coverage()` → `{points[], by_country[], totals}`. 점 클릭 → CinecodexCard → `/room/film/{slug}`.
- **✅ 확정(잠금)**: RPC 실측 — `film_locations JOIN user_movies(seen, auth.uid) WHERE lat IS NOT NULL`. **DB 5,669핀 전부 좌표 유효**(no_coords=0), 1,849영화·117개국. precision 계층 실존(venue/city/exact…). SVG 투영 수학 정확(`x=(lng+180)/360·760, y=(90−lat)/180·380`). 정직 empty. 색 구분(filmed teal/setting blue).
- **⚠️ 부족·모호**: (a) **국가→대륙 매핑 완전 하드코딩**(`COUNTRY_CONT`) → 사전에 없는 국가는 대륙통계·블라인드에서 조용히 누락. **블라인드가 데이터가 아닌 사전 공백을 반영**할 수 있음. (b) 커버리지 % 분모 `REF_NATIONS=50` 매직넘버. (c) **점 미중복제거** — 좌표공유 1,032핀이 겹쳐 찍힘(국가목록만 dedup).
- **🔧 보강안 (P1)**: 대륙 매핑 DB화(country→continent 참조테이블 조인, 프론트 하드코딩 제거 → 블라인드 진짜 데이터 파생). `REF_NATIONS`를 실측 분모로. 동일 좌표 dedup + "n편" 배지.
- **🔒 개인정보 🗺️**: **외부 타일/맵 프로바이더 호출 0**(hand-rolled SVG) — 타일서버가 IP·좌표 못 봄. lat/lng URL 미노출. **개인 관람지도로서 프라이버시 최적.**

### 2.7 감독 정복 (`/room/auteurs` · `AuteursWorkspace.tsx`)
- **역할**: seen≥1 감독별 오이브르 정복도(seen/total) 완파 4-state + 미관람 정전작 도장깨기.
- **데이터체인**: `me_auteur_conquest(40)` → 감독행 + 도장깨기. 필름 클릭 → `/room/film/{slug}`.
- **✅ 확정(잠금)**: RPC 실측(seen_dirs·totals·pct 실커버리지 수학). unseen_top = `prestige desc` + U 실값. **4-state 색 준수**(완파→`--conquer`, `--risk` 오용 없음). 정직 empty.
- **⚠️ 부족·모호**: **"완파 100%"의 함정** — `total`은 우리 DB 가시영화 수지 실제 전 필모그래피 아님(툴팁엔 명시되나 헤더 "전 작품 정복" 카피 과장). 소품수 감독이 쉽게 100%. `p_limit:40` 컷.
- **🔧 보강안 (P2)**: UI 카피를 "우리 DB 기준 정복도"로 통일. 선택: TMDB 외부 필모 총수 컬럼으로 "진짜 오이브르 %" 별도 표기.
- **🔒 개인정보**: 지도호출 없음. TMDB 포스터 CDN만(좌표/관람 URL 미노출). DEFINER+auth.uid.

### 2.8 촬영지 허브 (film inspector · `FilmContentHub.tsx`)
- **역할**: 필름 인스펙터에서 이어보기·비슷한영화·촬영지·가용성을 `film_room_context(slug)` 한 RPC로.
- **✅ 확정(잠금)**: locations = `film_locations WHERE film_id AND lat IS NOT NULL ORDER BY tier,confidence LIMIT 6`(실데이터). 정직 empty(전부 없으면 `null` 반환). 색 라벨(filmed/setting). avail 정직.
- **⚠️ 부족·모호**: 좌표 받지만 지도로 안 그림(이름·국가 텍스트만). filmed/setting을 도트색으로만 구분(텍스트 라벨 없음).
- **🔧 보강안 (P3)**: 프리뷰 행에 "(촬영지)/(무대)" 라벨. 필요시 인스펙터에 룸용 미니 SVG 지도 재사용.
- **🔒 개인정보 🗺️**: 지도 타일 호출 없음. `film_room_context`엔 개인식별 없음(공개 영화 컨텍스트).

### 2.9 geo API + FilmMap (필름/감독 Atlas 탭) 🗺️ — ※ 룸 밖이나 지도호출 감사 대상
- **역할**: `/api/geo`가 film/director/overview 핀 JSON 반환 → `FilmMap`(MapLibre)이 소비.
- **✅ 확정(잠금)**: `film_geo`/`director_geo`/`geo_overview` 실재·`lat NOT NULL`·`visible` 조인. 색 구분(filmed teal/setting red). 무좌표 정직 종료(탭도 `geoCount>0`일 때만).
- **⚠️ 부족·모호**: (a) **`/api/geo` 무스코프·무레이트리밋** — 익명 GET이 `geo_overview` 최대 5,000행 덤프 가능, 파라미터 검증 없음. (b) `geo_cache` — **2026-07-02 갱신: 3,951행으로 채워짐**(감사 시점엔 0행이었음). 지오코딩 캐시 파이프라인이 가동 중. 캐시↔`film_locations`(9,731 located·2,613 films) 정합·중복 여부는 재점검 대상. (c) 코드/DB `p_limit` 기본값 불일치(5000 vs 6000).
- **🔧 보강안 (P1)**: `/api/geo` 파라미터 화이트리스트 + 행수 상한(overview 2,000) + 간단 레이트리밋(edge/IP). `geo_cache` 파이프라인 연결 or 폐기 명시.
- **🔒 개인정보 🗺️ (중요)**: **`FilmMap`이 브라우저에서 외부 타일 직접 로드** — OpenFreeMap(`tiles.openfreemap.org`)·Esri(`server.arcgisonline.com`)·unpkg CDN → **이들이 사용자 IP + 조회 bbox 관측 가능**. 단 그리는 것은 공개 영화 촬영지(개인 신원/거주지 아님). 좌표는 URL 미노출(`?film=slug`만). *룸 Atlas(SVG)엔 없는 노출이 여기엔 있음* — 프라이버시 강화 시 self-host 타일 검토.

### 2.10 기록 · 평가 (`/room/rate` · `RateWorkspace.tsx`)
- **역할**: 반별점(0.5–5) 입력 워크스테이션. 별→자동 봤어요, ★4+ 이웃 fly-in.
- **데이터체인**: `me_rate_stats()`·`me_recent_ratings(40)`·`me_taste_signature(6)` (SSR) + `rate_film(slug,rating)`(write)·`film_search`·`me_taste_neighbors(4)`.
- **✅ 확정(잠금)**: **`rate_film`은 실제 mutation** — plpgsql DEFINER, `auth.uid()` null이면 예외, `insert…on conflict do update`, 0.5–5 클램프 서버 강제. 통계·최근·이웃 4종 DEFINER+auth.uid 실계산. `user_movies` RLS 5정책 정상.
- **⚠️ 부족·모호**: "취향 벡터 갱신" 문구는 이웃 재조회로만 반영(실 트리거 없음; `film_taste_vector`는 per-film 사전계산). RPC 마이그레이션 부재.
- **🔧 보강안 (P2)**: RPC 마이그레이션 커밋. 명시하려면 `user_movies` insert/update AFTER 트리거로 loved 캐시 재계산.
- **🔒 개인정보**: 내 별점·seen(본인만, 기본 private). 이웃은 내 취향 계산 결과(타 유저 데이터 아님). **누출 없음.**

### 2.11 서재 (`/room/library` · `LibraryWorkspace.tsx`)
- **역할**: 담아둔 영화·감독·트로프·미스리딩·리니지·형상 아카이브 + 공개/즐겨찾기.
- **✅ 확정(잠금)**: `me_library()` DEFINER+auth.uid(user_pins 정규화 + film_scores/user_movies 조인). `fav`는 실제 핀에서 시드. `user_pins` RLS `rw own`.
- **⚠️ 부족·모호**: **공개토글·즐겨찾기 전환이 DB 미저장(로컬만)** — `user_pins`에 per-pin visibility 컬럼 없음. UI가 "저장 파이프라인 형성 중" 정직 표기. 감독·리니지 핀 아직 없음(정직 empty).
- **🔧 보강안 (P2)**: `user_pins`에 `visibility text default 'private'` 컬럼(additive) + `set_pin_visibility(...)` RPC(auth.uid).
- **🔒 개인정보**: 내 핀 + 별점/seen 조인(본인만, 다크셸 전용). **공개토글이 아직 DB에 없어 실수 공개될 데이터 자체가 없음** — 현재 안전.

### 2.12 노트 · 글쓰기 (`/room/write` · `WriteWorkspace.tsx`)
- **역할**: 비평 컴포저(자유글/코멘트/강한오독/트로프) + 영화·framework 첨부, 공개/비공개.
- **✅ 확정(잠금)**: `me_authored_takes()` DEFINER+`author_id=auth.uid()`(읽기 실제). `takes` RLS 견고(read=published/owner/admin, insert own=author_id=auth.uid()+source='human').
- **⚠️ 부족·모호 ❌**: **저장/게시가 실제 insert 안 함** — draft 로컬 상태만, "게시" 버튼이 mutation RPC 미호출(RLS는 있으나 부르는 경로 없음). UI "영구 저장·게시 파이프라인 형성 중" 정직. `contentEditable` HTML → 향후 insert 시 **XSS sanitize 필수**.
- **🔧 보강안 (P1)**: `save_take(take_id,title,body,framework,films,pub)` RPC(author_id=auth.uid, with check) + **서버측 HTML sanitize**. 게시 버튼 배선.
- **🔒 개인정보**: 초안=본인(현재 메모리). 게시 시 `takes.read`상 전체 공개 — 단 게시 경로 없어 실노출 0. 향후 활성화 시 sanitize + 공개범위 재확인.

### 2.13 동행 · CONNECTION (`/room/pair` · `PairWorkspace.tsx`) 🔗
- **역할**: "하루 한 명" 취향 매칭 가면무도회. 싱크율 = 두 사람 loved 코사인.
- **데이터체인**: `me_pair_state()` + `me_taste_signature(6)`. `me_pair_state` → `{candidates, loved_n, forming}`.
- **✅ 확정(잠금)**: `me_pair_state`는 **타 유저 count만** 반환(`count(distinct user_id) where user_id<>auth.uid() and seen and rating≥4.5`) — 타 유저 id·평점·취향 **일절 미반환**. 파트너 없으면 **가짜 파트너 안 만듦**(정직 empty). "가면 벗기" disabled.
- **⚠️ 부족·모호 ❌ (스텁)**: **실제 파트너 링크 메커니즘 전무** — DB에 pair/partner/match/invite/connect 테이블 0건(실측). 초대·수락·동의 없음. 싱크율 계산 코드 없음. "동행 상대" KPI = "나 외 loved≥1 유저 수"지 매칭 상대 아님(오해 소지).
- **🔧 보강안 (P1) 🔗**:
  - `pair_matches(day, user_a, user_b, sync_pct, shared_anchors jsonb)` 테이블 + RLS(`auth.uid() in (user_a,user_b)`).
  - 매칭 잡 + `me_today_pair()` RPC — **교집합 앵커·싱크율만 반환, 실명·개별평점·전체취향 제외**.
  - 초대/동의는 별도 consent 레코드. **부분노출 스코핑을 프론트 아닌 RPC 레벨에서 강제.**
  - 그 전까지 "동행 상대" KPI 문구를 오해 없게(=아직 매칭 아님) 수정.
- **🔒 개인정보 🔗**: 현재 타 유저 노출 데이터 = 0(count만). **구현 시** 싱크율·교집합 앵커만 공개하고 실명·개별평점·전체취향은 비공개로 RPC에서 강제할 것. 현시점 누출 위험 없음.

### 2.14 공개 프로필 (`/u/[username]` · 링크 `/u/me`)
- **역할**: 라이트 스킨 공개 포트폴리오(관람작 + NAV/정전가). 다크셸 밖.
- **✅ 확정(잠금)**: `public_portfolio_meta`/`public_portfolio` DEFINER **이중 게이트**(`portfolio_public AND um.seen AND visibility='public'`). 비공개면 `notFound()`. **금지 필드 미노출 확인** — 13서브·신뢰도·prompt_sha·개별평점·취향벡터 전부 없음. `noindex`.
- **⚠️ 부족·모호**: **`/u/me` 링크 404** — username="me" 유저 없고 `[username]`에 "me"→현재유저 리다이렉트 없음 → `public_portfolio_meta('me')` null → notFound. 자기 공개프로필 접근 불가.
- **🔧 보강안 (P1)**: `RoomShell` 링크를 로그인 username으로 치환, 또는 `app/u/me/route.ts` 리다이렉트(profiles where id=auth.uid()의 username으로 302).
- **🔒 개인정보**: 노출대상 = anon 포함 전체, 단 이중 옵트인일 때만(기본 private). 노출 = 표시명·bio·아바타·공개관람작(포스터/정전가)·NAV. **금지필드 누출 없음.** 유일 이슈는 self-link 404(누출 아닌 UX).

### 2.15 셸 · 평가카드 · Cinecodex (`RoomShell`/`Inspector`/`CmdK`/`EvalCard`)
- **✅ 확정(잠금)**:
  - **셸**: 4열 불변식 + 컬럼별 localStorage collapse + 뷰포트 auto-collapse. 인증 가드(서버, 없으면 `/login?next=/room`, noindex). NAV chip·rail counts 실 RPC. ⌘K = `film_search` 실 RPC. Inspector select/폴백(설명가능성). **내비 12링크 전부 대상 라우트 실재**(404 없음; `/u/me`만 §2.14 해석 이슈).
  - **평가카드**: `cinecodex_card(slug)` 실 필드 — 13서브(`d.subs`)·비교작(`d.comps`)·신뢰도(`d.reliability`) 전부 실측(fabricate 없음). `v==null`이면 `notFound()`. U/S/미적사다리/판정문은 결정론적 수식(LLM 아님). **never-blend 준수**(트립티크·`.sbs` 3칸 분리). N=1·flagged 정직 공개.
- **⚠️ 부족·모호**:
  - **티커 4항 중 3항 + activity "시스템 상태" 카드 3항이 하드코딩** — `6,701편`(실측 6,701과 우연히 일치하나 정적)·`v2-fixA`·`Vertigo 84.5`·`취향 벡터 활성`. **no-fake-data 소프트 위반.**
  - **per-film 비평 산문 미구현** — 서브별 근거가 정의된 루브릭 라벨의 재진술(정직하나 "왜"의 깊이 얕음). fake 산문은 없음(정직한 미구현).
  - CmdK film 링크가 `/film/{slug}`(공개사이트)로 나가 룸 셸 이탈(의도 모호). PAGES 목록이 5개만(atlas/auteurs 등 누락). CinecodexCard 정전 "발견" `"—"` 고정.
- **🔧 보강안**:
  - (P0) 티커/시스템카드를 `me_system_status()` RPC(총 채점편수·모델버전·최근 재계산 대상)로 교체 or 실연결 전까지 `—`.
  - (P3) per-sub rationale 필드를 RPC에 추가(없으면 라벨 폴백 유지 — fake 금지). CmdK 링크 `/room/film/{slug}` 통일 + PAGES를 NAV와 동기화.
- **🔒 개인정보**: 13서브·신뢰도는 `/room/film`(비공개·noindex) 내에만. 공개 프로필 미노출(§2.14 확인).

---

## 3. 개인정보 흐름 종합

| 데이터종류 | 저장위치 | 노출대상 | 스코핑 | 우려 |
|---|---|---|---|---|
| 별점·seen·watched | `user_movies` (기본 private, 실측 26행 전부 private·공개 0) | 본인 (옵트인 시 anon) | RLS 5정책 `auth.uid()=user_id`; `rate_film`/`me_rate_stats`/`me_recent_ratings` DEFINER+uid | 낮음. **rate_film 실 mutation** |
| 취향벡터/이웃/시그니처 | `film_taste_vector` (RLS on·**정책 0=default-deny**) | 본인 계산 결과만 | `me_taste_*` DEFINER+uid; 클라 직접읽기 차단 | 낮음. 타 유저 벡터 접근 불가 |
| 핀·서재 | `user_pins` | 본인 | RLS `rw own`=auth.uid; `me_library` DEFINER+uid | 낮음. **공개토글 로컬만·DB 미반영** |
| take 비평 | `takes` (게시 경로 프론트에 없음) | 초안=본인/게시=전체(published) | RLS read/insert own; `me_authored_takes` DEFINER+author_id | 저장 자체가 로컬→현 누출 0. 향후 게시 시 **HTML sanitize** |
| 동행/파트너 | **테이블 없음** | — | `me_pair_state`=타 유저 COUNT만 | 스텁. 현 누출 0. **구현 시 RPC 레벨 부분노출 강제** |
| 공개 포트폴리오 | `profiles`(portfolio_public) + `user_movies`(visibility) | anon 포함(이중 옵트인) | `public_portfolio(_meta)` DEFINER 이중게이트 | 낮음. **금지필드·개별평점·취향벡터 미노출** 확인 |
| 촬영지 좌표 | `film_locations` (RLS on·정책 0=default-deny) | DEFINER RPC 경유만 | `me_geo_coverage`(uid)·`film_geo`/`geo_overview`(공개) | 룸 Atlas 안전(외부호출 0). **FilmMap 외부타일 IP노출** |

**advisor 참고**: 유저테이블(user_movies/user_pins/takes/profiles) 무결점. ERROR 8건은 무관한 집계 뷰(security_definer_view). `me_*`는 WARN(anon/authenticated 실행 가능하나 내부 auth.uid 필터로 데이터 보호). `film_taste_vector`/`film_locations`/`geo_cache`는 INFO/의도된 default-deny.

---

## 4. 지도(Map) 호출 세부 로직 🗺️

- **룸 Atlas (`/room/atlas`)** = **hand-rolled SVG, 외부 타일 호출 0** → 타일서버가 IP·좌표 못 봄. 개인 관람 지도로 최적. 데이터 `me_geo_coverage`(auth.uid seen 핀, 5,669 실측). **결함**: 대륙매핑 하드코딩(→블라인드가 사전공백 반영), REF=50 매직넘버, 점 미중복제거(1,032 겹침).
- **필름/감독 Atlas 탭 (`FilmMap`)** = **MapLibre + 외부 타일**(OpenFreeMap·Esri·unpkg). **IP+bbox가 타일 프로바이더에 노출**(단 공개 촬영지, 개인신원 아님). 데이터 `/api/geo`(공개 RPC). **결함**: 무스코프·무레이트리밋(anon 5,000행 덤프 가능), `geo_cache` 미가동.
- **공통 준수**: lat/lng를 URL 쿼리에 안 실음(프라이버시 규칙 OK). `film_locations`/`geo_cache`는 RLS default-deny → DEFINER RPC 전용(방어적이나 미문서화 — 향후 직접 `.from()` 시 조용한 빈 결과 주의).
- **보강 우선순위**: (P1) `/api/geo` 스코프/레이트리밋 + overview 행수 상한. (P1) 대륙매핑 DB화. (P2) SVG 점 dedup. (P3) 프라이버시 강화 시 self-host 타일 검토.
- **2026-07-02 갱신**: `film_locations`가 5,669→**9,731 located**(2,613편)로, `geo_cache`가 0→**3,951**로 증가(지오 백필 진행 중). Atlas 데이터는 더 풍부해졌으나 위 구조 결함(대륙매핑 하드코딩·점 미중복제거·무레이트리밋)은 그대로.

---

## 5. 커넥션(동행) 호출 세부 로직 🔗

- **현재 상태 = 완전 스텁**. `me_pair_state`는 "나 외 loved≥1 유저 수 COUNT"만 반환. 파트너 링크/매칭/초대/동의 테이블 **전무**(실측). 싱크율 계산 없음.
- **위험**: 현재 타 유저 데이터 노출 0(안전)이나, "동행 상대" KPI가 매칭 상대인 것처럼 오해될 수 있음.
- **보강 설계 (P1)**:
  1. `pair_matches(day, user_a, user_b, sync_pct, shared_anchors jsonb)` + RLS `auth.uid() in (user_a,user_b)`.
  2. 일일 매칭 잡(loved 벡터 코사인 상위 매칭) → `me_today_pair()` RPC.
  3. **RPC가 반환하는 것 = 싱크율 + 교집합 앵커만.** 실명·개별평점·전체취향 **절대 미반환**(프론트 신뢰 금지, RPC 레벨 강제).
  4. 초대/수락/동의(consent) 레코드로 상호 동의 후에만 "가면 벗기"(공개 프로필 링크) 활성.

---

## 6. 데이터 · RPC 인벤토리

**RPC 20종 전부 실존·`SECURITY DEFINER`(실측). 개인 데이터 17종은 `auth.uid()` 참조 확인. 공개데이터 3종(cinecodex_card·film_room_context·film_search)은 uid 미참조(정상). 단 20종 전부 마이그레이션 파일에 없음(out-of-band).**

| RPC | 호출 | auth.uid | 마이그레이션 |
|---|---|---|---|
| me_portfolio_nav / portfolio_breakdown | layout, room, analysis | ✅ | ❌ MISSING |
| me_recommend_wwi | watchlist, room, desk | ✅ | ❌ |
| me_collection | room, collection, analysis | ✅ | ❌ |
| me_taste_neighbors / me_taste_signature | room, analysis, rate, pair | ✅ | ❌ |
| me_figure_cloud | analysis | ✅ | ❌ |
| me_watched_scored / me_takescore_summary | desk | ✅ | ❌ |
| me_auteur_conquest | auteurs | ✅ | ❌ |
| me_geo_coverage | atlas | ✅ | ❌ |
| me_library | library | ✅ | ❌ |
| me_authored_takes | write | ✅ | ❌ |
| me_rate_stats / me_recent_ratings | rate | ✅ | ❌ |
| me_pair_state | pair | ✅ | ❌ |
| rate_film (mutation) | rate | ✅ | ❌ |
| cinecodex_card / film_room_context / film_search | film, hub, CmdK | — (공개) | ❌ |

**미존재(호출되지도 않으나 보강 시 신설 대상)**: `me_coverage`(⑦)·`me_blindspots`(④)·`me_nav_history`(자산곡선)·`me_system_status`(티커).

**색 토큰** (`room.css`): `--risk #D64518`(위험 R) · `--red #E3120B`(브랜드 chrome) · `--conquer #E3120B`(완파, =red 계열) · `--frontier #3E8FE0`(진입비용/외부). **risk ≠ conquer 확인, 오용 0.**

---

## 7. 우선순위 로드맵

**P0 (로직 정합성 — 지금)**
1. `me_coverage()` + `me_blindspots()` 신설 → 커맨드센터·분석의 ⑦④ 실배선(portfolio_breakdown.canon 종속 제거).
2. `me_recommend_wwi`에 conquer/Δ-gap을 위 RPC 조인으로 실태깅 → 데스크 5전략 사망 해소.
3. watchlist/desk 담기·봤어요·관심없음 mutation RPC(`me_set_watchlist`·`me_mark_seen`) 배선.
4. 셸 티커/시스템카드를 `me_system_status()`로 교체 or `—` 처리(하드코딩 제거).

**P1 (기능 완성 + 프라이버시 강화)**
5. `nav_snapshots` + `me_nav_history()` → 자산곡선 실렌더(단조 어서션).
6. 동행 `pair_matches` + `me_today_pair()` + consent(§5) — 부분노출 RPC 강제.
7. 노트 `save_take()` RPC + **HTML sanitize**.
8. `/api/geo` 스코프·레이트리밋·행수 상한. Atlas 대륙매핑 DB화.
9. `/u/me` 404 수정(self-redirect).

**P2 (정합·중복제거)**
10. 서재 `user_pins.visibility` 컬럼 + `set_pin_visibility()`. 컬렉션 "최근순" + "발견" 배선. summary best/riskiest 배선. auteurs "DB 기준" 카피. SVG 점 dedup. 임계 상수 모듈화.

**P3 (심화)**
11. per-sub 비평 rationale 필드(fake 금지, 없으면 라벨 폴백). CmdK 링크 룸 통일. 촬영지 허브 라벨/미니맵. 프라이버시 강화 시 self-host 타일.

**구조 (상시)**
12. **room RPC 20종을 마이그레이션 파일로 역커밋**(`supabase/migrations/00xx_room_me_rpcs.sql`) — 리뷰·롤백·재현 확보.

---

## 8. 검증 근거 (실측 스냅샷, 2026-07-01)

- room RPC 20종: 전부 실존·SECURITY DEFINER. 개인 17종 auth.uid 참조 ✓. `me_coverage`/`me_blindspots`/`me_nav_history`/`me_system_status` **부재** ✓.
- RLS 정책수: user_movies 5 · takes 3 · profiles 2 · user_pins 1 · film_locations 0 · film_taste_vector 0 · geo_cache 0(모두 RLS on).
- 데이터: cinecodex 채점 6,701 · 좌표핀 5,669 · 117개국 · user_movies 26행(공개 0).

---

## 9. 개정 로그

- **2026-07-03 (2차)** **P1 전항 완료 + P2 소화 + 구조(RPC 스냅샷) 완료.** 동행 실구현(0031: `pair_matches` RLS 정책 0 default-deny — 파트너 uuid 직접 노출 차단, `me_today_pair`/`me_pair_reveal`/`me_pair_history` 부분노출 RPC 강제, 일자별 결정적 페어링·상호동의·공개프로필 게이트). `/api/geo` 파라미터 화이트리스트+400+IP 레이트리밋. Atlas 대륙매핑 DB화(0032: `country_continents` 156국 — 미매핑 0 실측, `me_geo_coverage` v2 continent·countries_total) + SVG 점 dedup(n편 배지) + REF=50 제거. 기존 RPC 18종 바이트 정확 스냅샷(0033). P2: 컬렉션 "최근순"·CinecodexCard "발견" 배선(전 호출부 discovery)·auteurs DB기준 카피·CmdK 룸 통일·desk best/riskiest 배선. **잔여 = P3 + cinecodex DDL 역커밋.**
- **2026-07-03** **P0 1–4 전부 + P1 5·7·9(/u/me) 해소** (마이그레이션 0027–0030 + 프론트 배선; 상세는 `ROOM-HANDOVER-MASTER.md` §8·§11). ⑦`me_coverage`·④`me_blindspots`(생산성 게이트) 신설·배선, `me_recommend_wwi` v2(conquer/gap 실태깅·in_watchlist·seen/dismissed만 제외), 쓰기 6종 mutation(`me_set_watchlist`/`me_mark_seen`/`me_dismiss`/`set_pin_visibility`/`me_toggle_fav`/`save_take`+서버측 sanitize), `me_system_status` 티커/시스템카드 실데이터, `nav_snapshots`+`me_nav_history` 자산곡선 실렌더(단조 어서션), `/u/me` 302. **잔여**: 동행(P1-6§5), `/api/geo` 스코프·대륙매핑(P1-8), P2/P3, 기존 RPC 20종 역커밋.
- **2026-07-01** 최초 작성. 4개 병렬 감사 에이전트(자산운영/지도·감독/개인정보·교류/셸·RPC) + 라이브 DB 실측 통합. 상태 대시보드·개인정보 흐름표·지도/커넥션 세부·P0–P3 로드맵 확립.
