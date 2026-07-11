# HANDOFF — TakeScore Screener 전면 리디자인 (단일 정본)

> **✅ 구현 완료 (2026-07-11).** 기획+구현 모두 이 세션에서 수행. 마이그레이션은 **0070**(문서 본문의 `00xx`/`0068` 표기는 0070으로 읽을 것) — 프로덕션 적용 완료. 프론트: `app/takescore/page.tsx`(재작성)+`app/takescore/screener.css`+`components/screener/{ScreenerExplorer,ScoreBrush,ProviderPicker,FilmCardPanel}.tsx`+`lib/takescore_presets.ts`+`app/api/lens/takescore/route.ts`(확장). 아래 §4의 전 기능(P0~P5) 라이브. `film_provider_index`는 provider 갱신 시 `select fpi_rebuild();` 재실행(worker/external-data.py 훅 대기).
>
> **이 문서가 정본.** /takescore 허브를 "서비스의 메인이 되어도 좋은" 공개 스크리닝 터미널로 전면 업그레이드. 기획: 2026-07-11 (원우 지시).
> 관련 정본: `HANDOFF-마이룸-v3-redesign.md`(계기 개념), `HANDOFF-마이필름-렌즈.md`(렌즈 불변식), `docs/00-INDEX.md` 등록됨.

---

## 0. 한 문장 정의

**/takescore = The Screener** — 누구든 10초 안에 (1) 아무 영화나 검색해 **종합 점수(TakeScore + IMDb/RT/Metascore)를 즉시 확인**하고, (2) 그 영화를 **탭으로 고정해 여러 편을 비교**하고, (3) **내 조건(연도 이후·제작국·내 구독 서비스·안 본 것만)**으로 전체 랭킹을 스크리닝하고, (4) **원클릭으로 내 리스트에 추가**하는 페이지. 금융 터미널의 스크리너 은유(마이룸 v3의 Screener 계기)를 공개 표면으로 가져온 것.

---

## 1. 현황 진단 (2026-07-11, 코드 기준)

현재 구현: `app/takescore/page.tsx`(124줄, 서버) + `components/CodexExplorer.tsx`(380줄, 클라이언트) + `/api/lens/takescore`(only-모드 미러).

| # | 원우 지적 | 코드 상 원인 | 판정 |
|---|---|---|---|
| 1 | 영화 검색해서 빠르게 종합 점수 확인 불가 | `cx-search`는 그리드 필터일 뿐. 검색→점수 즉답 UX 없음. IMDb 등 외부 점수는 행을 열어야(Curtain) 보임 | **신규 설계** (§4-A) |
| 2 | 탭으로 여러 영화 띄워두기 불가 | 개념 자체가 없음. Curtain은 한 번에 1개만 열림(`open` 단일 state) | **신규 설계** (§4-B) |
| 3 | 소팅/선택 불편 | 정렬 7개 칩·λ 다이얼·국가 select·13차원 레인지가 한 패널에 평면 나열. 위계 없음 | **재구성** (§4-C) |
| 4 | 연도 단일 선택, "이후" 개념 없음 | UI가 decade 칩 단일 선택. **RPC는 이미 `p_year_min/max` 지원** — UI만 고치면 됨 | **UI만 수정** (§4-C) |
| 5 | "내가 본 영화 제외" 큰 버튼 없음 | 렌즈 모드가 off/highlight/**only**뿐. **exclude 모드 부재**(LensProvider.tsx:21) | **DB+UI 신규** (§4-D) |
| 6 | 구간선택 그래프 안 이쁨, 그리딩 안 됨 | `DualRange` = range input 2개 겹침(CodexExplorer.tsx:60). 분포 정보 0, 조작감 나쁨 | **분포 브러시로 교체** (§4-E) |
| 7 | 썸네일 너무 작고 숫자와 간격 벌어짐 | 포스터 `w92`(IMG 상수), 행 레이아웃에서 제목·숫자·TS박스가 좌우로 흩어짐 | **그리드 v2** (§4-F) |
| 8 | 랭킹 보기 중요 | 그리드에 순위 번호 없음(하단 크롤용 리스트에만 있음) | **rank 컬럼** (§4-F) |
| 9 | 구독 매체·국가 선택 뷰 | 데이터는 있음(`film_watch_providers` 6,974편×국가별 jsonb) — 필터로 안 이어짐 | **DB+UI 신규** (§4-G) |
| 10 | 내 리스트 추가 쉽게 | `PosterActions`(✓ seen / + watchlist) 이미 존재 — 이 페이지에 미배치 | **배치만** (§4-F) |
| 11 | 네비게이션 종합 불편 | 필터 상태가 URL에 없어 공유·뒤로가기 불가, 히어로 없음, 페이지 정체성이 "긴 설명문+패널" | **IA 재편** (§3) |

**살릴 것**: `cinecodex_ranked` RPC(정렬·λ·연도범위·국가·13차원 range·페이징 전부 지원), 13차원 랜딩(`/takescore/[dim]`), `/takescore/film/[slug]` 어프레이절 6,701편, `/takescore/about`, 하단 서버렌더 크롤 백본(500위), JSON-LD, `cinecodex_card`(탭 카드에 재사용), `/api/lens/takescore` 미러 패턴.

---

## 2. 보유 데이터 확인 (전부 프로덕션에 실존, 2026-07-11 검증)

| 데이터 | 위치 | 규모 | 비고 |
|---|---|---|---|
| TakeScore 13서브+V/C/R | `cinecodex.scores` | 6,701편 | LLM 채점(유료) — **재채점 금지, 읽기만** |
| 외부 점수 | `film_ratings` (imdb_rating·imdb_votes·metascore·rt_tomatometer) | 6,931편 | OMDb 소스 |
| 시청 제공자 | `film_watch_providers` (film_id, results jsonb, countries[], fetched_at) | 6,974편 | 국가코드→{flatrate/ads/free/rent/buy}[{provider_id, provider_name, logo_path}] . 소비 선례: `components/WatchProviders.tsx`, `AccessSummary.tsx`, `/whereto/[slug]` |
| 제작국 | `curation.film.country_code` (RPC가 이미 join) | — | `cinecodex_countries` RPC로 목록 |
| 내 시청기록 | `user_movies` (seen, watchlist, rating, dismissed) | 사용자별 | RLS. `PosterActions` ctx가 토글 |
| 렌즈 | `LensProvider` (off/highlight/only) + `cinecodex_ranked_mine` + `/api/lens/takescore` | — | **exclude 모드만 추가하면 됨** |
| 탭 카드 데이터 | `cinecodex_card` RPC | — | /takescore/film/[slug]이 쓰는 단일 RPC. V/C/R·13서브·ext·rank 포함 |

---

## 3. IA — 페이지 구성 (위→아래)

```
┌─────────────────────────────────────────────────────────┐
│ A. 블랙 히어로 (rd-hero 관례, read.css)                    │
│    "TakeScore™ Screener" + 한줄 정의 + 대형 즉답 검색창    │
│    검색창 아래: 오늘의 프리셋 스크린 칩 4개 (§4-H)          │
├─────────────────────────────────────────────────────────┤
│ B. 필름 탭 트레이 (고정한 영화들 — 비어있으면 숨김)          │
│    [Parasite 91│x] [Mulholland Dr. 88│x] [+비교]          │
├─────────────────────────────────────────────────────────┤
│ C. 컨트롤 바 (sticky, 한 줄 위계)                          │
│    [Hide seen ●○] [Since 2010 ▾] [국가 ▾] [내 서비스 ▾]   │
│    [정렬 ▾] [차원 필터 N ▾] ······ 6,701 films             │
├─────────────────────────────────────────────────────────┤
│ D. TS 분포 브러시 (히스토그램 + 드래그 구간선택)            │
├─────────────────────────────────────────────────────────┤
│ E. 결과 그리드 v2 (rank·포스터 w154·점수 인접·저장버튼)     │
│    행 클릭 → 탭 트레이에 고정 (Curtain 대체)               │
├─────────────────────────────────────────────────────────┤
│ F. My 탭 스트립 (로그인 시): My Slate n · Seen n → /room   │
├─────────────────────────────────────────────────────────┤
│ G. 13차원 섹션 (현행 유지, 카드형으로 압축)                 │
│ H. 크롤 백본: 서버렌더 풀랭킹 500 (현행 유지)              │
└─────────────────────────────────────────────────────────┘
```

**라우트는 /takescore 유지**(SEO 자산·GSC 등록 보존). "메인 승격"은 §9 오픈 결정.

---

## 4. 기능 스펙

### 4-A. 즉답 검색 (히어로 검색창)
- **타이프어헤드**: 기존 `/api/search?kinds=film`(unified search) 재사용 — 입력 300ms 디바운스, 상위 6편 드롭다운. 각 항목에 포스터 + **TS 점수 pill**을 함께 표시해야 하므로, 검색 결과 slug들로 `cinecodex_for`(이미 존재, slug 배열→점수) 1회 배치 조회해 병합.
- **선택 시**: 그리드 필터링이 아니라 **탭 트레이에 고정**(B). 즉, "검색=이 영화 점수 보기"라는 멘탈모델. 그리드 필터 검색은 컨트롤 바 안에 별도 소형 입력으로 분리(현 `cx-search` 이동).
- 미채점 영화(Tier-2 274편 등)를 선택하면 탭에 "Not yet appraised" 상태 카드 + /film/[slug] 링크.

### 4-B. 필름 탭 트레이 (핵심 신기능)
- **개념**: 브라우저 탭처럼 영화를 핀. 여러 개 유지, 세션 넘어 유지(localStorage `mt-ts-tray`, slug 배열, 최대 12).
- **탭 칩**: 미니 포스터 + 제목 + TS 숫자 + ×. 클릭하면 그 탭의 **카드 패널**이 트레이 바로 아래 펼쳐짐(한 번에 1개 카드, 탭 전환은 즉시).
- **카드 패널 내용** (`cinecodex_card` 1회 호출, 클라이언트): TS 대형 숫자 + V/C/R 도넛(기존 `ScoreDonut` 재사용) + **IMDb ★n.n (투표수) · RT n% · Metascore n** 한 줄 + 13서브 미니바 + 랭크(#n of 6,701) + [Full appraisal →/takescore/film/slug] [+ Watchlist] [✓ Seen] + **Where to watch**(내 시청국 기준 flatrate 로고 행, `film_watch_providers` 1회 조회).
- **비교 모드**: 탭 2개 이상일 때 [Compare] 버튼 → 카드 패널이 고정된 탭 전부를 컬럼으로 나란히(모바일은 가로 스크롤). 같은 행에 같은 지표(TS/V/C/R/IMDb/RT)가 오도록 정렬된 표형.
- 그리드 행 클릭도 "탭에 고정"으로 통일(현 Curtain 아코디언 제거 — 단일 인터랙션 모델).
- **URL 공유**: 트레이는 `?pin=slug1,slug2` 쿼리로도 직렬화(공유 링크로 비교 상태 재현).

### 4-C. 컨트롤 바 v2 (sticky)
- **위계**: 자주 쓰는 것(Hide seen·연도·정렬)이 항상 보이고, 무거운 것(13차원)은 접힘. 모바일은 바텀시트.
- **연도**: 칩 프리셋 `[All] [Since 2020] [Since 2010] [Since 2000] [Since 1990] [Custom…]` + Custom 선택 시 듀얼 슬라이더(1910–2026). "이후(since)" = `p_year_min`만 세팅. **RPC 변경 불필요.** decade 단일선택 UI 폐기.
- **정렬**: 현행 7종 유지하되 select 하나로 압축 + 정렬 방향 아이콘. λ 다이얼은 "TakeScore 정렬일 때만" 정렬 select 옆에 인라인 노출(현행 로직 유지).
- **국가(제작국)**: 현행 select 유지(`cinecodex_countries`). 라벨을 "Made in"으로 명확화 — **시청국과 혼동 방지**.
- **모든 필터 상태를 URL 쿼리에 동기화** (`useSearchParams`+`router.replace`, 디바운스): `?q=&sort=u&lam=1.0&since=2010&to=&country=KR&watch=KR&prov=8,337&hide=seen&ts=60-100&dims=cog:70-100`. 뒤로가기·공유·북마크 전부 동작. 이것이 "네비게이션 불편"의 근본 해결.

### 4-D. Hide seen (크고 잘 보이는 토글)
- 컨트롤 바 **맨 앞**에 대형 토글: `● Hide films I've seen (n)`. 로그인+시청기록 있을 때 활성; 아니면 클릭 시 툴팁 "Sign in and mark films seen (or import your history) → /me/import".
- **구현**: 신규 마이그레이션으로 `cinecodex_ranked_mine`에 `p_mode text default 'only'` 파라미터 추가(`'only'`|`'exclude'`) — exclude면 `not exists(select 1 from user_movies um where um.user_id=p_user and um.film_id=f.id and um.seen)`. **시그니처가 바뀌므로 구 시그니처 drop 필수**(create-or-replace 오버로드 함정). `/api/lens/takescore`에 `mode` 쿼리 패스스루. 서비스롤 전용 유지(RLS 우회이므로 GRANT 금지 유지).
- LensProvider의 전역 모드(off/highlight/only)는 **건드리지 않는다** — hide-seen은 이 페이지 로컬 상태(URL `hide=seen`). 전역 렌즈 only-모드와 동시 켜짐은 모순이므로 only-모드일 땐 hide-seen 토글 비활성+설명.
- **서버 HTML 개인화 금지 불변식 준수**: SSR 초기 rows는 항상 전역. hide=seen은 클라이언트 fetch에서만.

### 4-E. TS 분포 브러시 (DualRange 대체)
- 그리드 위에 **TakeScore 히스토그램 1개**(버킷 5점×20개, 현재 필터 적용된 분포): SVG 바 차트, 위에서 드래그로 구간 선택(brush) → `ts=lo-hi` 필터. 선택 구간 밖은 회색, 안은 그린(#0F6E56). 우측에 "n films in range".
- **신규 RPC** `cinecodex_histogram(p_*: cinecodex_ranked와 동일 필터 인자) → {bucket int, n int}[]` (group by width_bucket). 6,701행 집계라 수 ms.
- 13차원 레인지 필터: 접힘 패널 유지하되 각 행의 DualRange를 **미니 분포 스파크(정적, 전역 분포) 위 브러시**로 교체 — 같은 컴포넌트 재사용(`ScoreBrush`, 사이즈 프롭). 분포 스파크 데이터는 서버에서 1회 프리컴퓨트해 페이지 프롭으로(13차원×20버킷, 전역 고정이라 ISR 캐시에 실림).
- 조작: 포인터 드래그 + 키보드(좌우 화살표) + 더블클릭=리셋. 터치 40px 히트영역.

### 4-F. 결과 그리드 v2
- **행 규격** (데스크톱): `[#rank] [poster w154 (66×99px 표시)] [제목(연도·감독) + 점수띠] [TS box] [+/✓]`
  - **rank**: 현재 정렬 기준 순위(오프셋+인덱스). 정렬이 TakeScore일 때는 "전역 랭크"와 일치 — `#12 of 6,701` 툴팁.
  - **점수띠**: 제목 바로 아래 한 줄, 간격 촘촘히: `TS 91 · V 88 · C 41 · R 12 · IMDb 8.6 · RT 99%` — **숫자가 제목 옆에 붙어** 현 "간격 벌어짐" 해결. IMDb/RT는 `film_ratings` join(아래 RPC v8).
  - **TS box**: 현행 그린 박스 유지(어프레이절 링크). 크기 ↑.
  - **[+/✓]**: `PosterActions` 상시 노출(hover 의존 금지 — 모바일). 리스트 추가가 "쉽게 누를 수 있는" 1클릭.
- 밀도: 데스크톱 2열(현 1열 카드 리스트 → 2열 그리드, 1280px+에서), 모바일 1열. 행 높이 ~110px.
- **RPC v8**: `cinecodex_ranked`에 `imdb_rating numeric, rt int` 반환 컬럼 추가(film_ratings left join) + `p_providers int[] default null, p_watch_country text default null` 인자(§4-G). **시그니처 변경 → 구 시그니처 drop + `cinecodex_ranked_mine`·`/api/lens/takescore`·`CodexExplorer`·`/room/screener`(있다면) 등 호출부 전수 조사 후 동시 수정.** 반환 shape 바뀌므로 관련 unstable_cache 키 범프.
- 스켈레톤 로딩(레이아웃 시프트 방지), 무한스크롤 대신 현행 Load more 유지(크롤·성능 예측성).

### 4-G. 내 구독 서비스 × 시청국 필터
- **컨트롤**: `[Watch country ▾ (기본: 브라우저 지역 추정 or KR)]` + `[My services ▾]` 멀티셀렉트(로고 그리드 팝오버, 해당 국가에서 flatrate 제공자 상위 ~30개: Netflix, Disney+, Watcha, TVING, wavve, Prime…). 선택은 localStorage `mt-watch-prefs` = `{country:"KR", providers:[8,337,97]}` 저장 — **로그인 불필요**, 재방문 시 유지.
- 필터 ON이면: "지금 KR의 Netflix·Watcha에서 스트리밍 중인 것만" 랭킹. 결과 행에 제공자 미니 로고(≤3) 표시.
- **DB — 정규화 인덱스 신설**(jsonb 스캔은 랭킹 쿼리에 부적합):
  ```sql
  create table film_provider_index (
    film_id uuid references films(id) on delete cascade,
    country_code text not null,       -- 'KR'
    provider_id int not null,
    provider_name text not null,
    kind text not null,               -- 'flatrate'|'ads'|'free' (rent/buy 제외 — 구독 필터 목적)
    primary key (film_id, country_code, provider_id, kind)
  );
  create index on film_provider_index (country_code, provider_id) include (film_id);
  -- 빌더: film_watch_providers.results를 국가×kind로 unnest하는 refresh 함수
  create function fpi_rebuild() ... ;  -- lateral jsonb_each + jsonb_array_elements
  ```
  `fpi_rebuild()`는 마이그레이션에서 1회 실행 + `worker/external-data.py`가 providers 갱신할 때 재실행(런북 한 줄 추가). 예상 행수 수십만(6,974편×국가×제공자) — 문제 없음.
- **RPC v8 필터 절**: `and (p_providers is null or exists (select 1 from film_provider_index x where x.film_id=f.id and x.country_code=p_watch_country and x.provider_id = any(p_providers)))`.
- **제공자 목록 RPC** `provider_directory(p_country text) → {provider_id, provider_name, logo_path, n_films}[]` (film_provider_index group by, 상위 30). 팝오버 데이터.
- 신선도: `film_watch_providers.fetched_at` 최솟값을 각주로 "Availability via TMDB/JustWatch, updated {date}" — 법적/정확성 표기.

### 4-H. 프리셋 스크린 (에디토리얼 큐레이션 = 컨텐츠 확장)
히어로 검색창 아래 칩 4~6개 — **전부 기존 필터의 파라미터 프리셋**(콘텐츠 제작 0, LLM 0):
| 칩 | 파라미터 |
|---|---|
| Safe bets | sort=u, dims=bank:0-25 (낮은 Hollowness·낮은 Risk) |
| High wire | sort=v, dims=fr:70-100 (형식 급진 고가치) |
| Hidden gems | sort=u, imdb_votes<50k (RPC v8에 p_max_votes 추가) |
| 90 in 90 min | sort=u, ts=85-100 + runtime≤95 (films.runtime 있으면; 없으면 이 칩 제외) |
| Fresh century | since=2000, sort=u |
| On my services | watch 필터 ON 유도(§4-G) |
프리셋 클릭 = URL 쿼리 세팅일 뿐. 칩 정의는 `lib/takescore_presets.ts` 상수로(추후 확장 용이).

### 4-I. My 탭 스트립 (마이룸 개념 이식)
그리드 아래, 로그인 시에만 클라이언트 렌더(비로그인 = 렌더 생략, SSR 불변):
- **My Slate** (watchlist n편): 이 중 TakeScore 상위 5 미니 행 + "지금 내 서비스에서 볼 수 있는 것 n" → `/room/screener`·`/room/slate` 링크. (마이룸 Slate=pipeline 개념의 공개면 티저)
- **My Ledger** (seen n편·평균 내 별점 vs TS 상관 한 줄) → `/room/ledger`.
- 데이터: 기존 lens ctx의 seen/watchlist set + `cinecodex_for` 배치 조회. 신규 RPC 불필요.
- 이 스트립이 "/takescore ↔ /room" 순환 동선을 만든다 (공개 스크리너 → 개인 터미널).

---

## 5. 디자인 스펙

- **블랙 히어로**: `rd-hero` 관례 재사용(`app/film/[slug]/read.css` — catalog/concept 페이지와 동일 문법). 배경: TS 상위권 영화 backdrop 1장(서버에서 상위 20 중 랜덤 아님 — **결정적**으로 #1 영화, ISR 캐시 일관성) + 어두운 그라디언트. 내용: 크럼 `TakeScore` / H1 `TakeScore™ Screener` / 서브 한 줄(현 lh-def 압축: "Value − λ·Risk. 6,701 films appraised. Not popularity.") / **대형 검색창**(ox-box 스타일 차용) / 프리셋 칩. 히어로 우측에 `#1` 영화 미니 크레딧("From {title} · via TMDB" — rd-hero__cap 관례).
- **색 체계 유지**: V 그린 `#0F6E56` / C 그레이 / R 레드 `#C8102E` (AX 상수). TS 숫자는 그린 모노스페이스(tabular-nums) — 기존 cxd-ts 문법 계승.
- **분포 브러시**: 바 fill 그린, 비선택 `#d8d8d8`, 브러시 핸들 2px ink. 높이 64px(메인), 28px(차원 미니).
- **탭 트레이**: 칩 = 포스터 18×27 + 제목(ellipsis 12ch) + TS pill. 활성 탭 하단 2px 그린 보더. 가로 스크롤(스크롤바 숨김).
- **모바일**(≤560px): 히어로 검색 풀폭, 컨트롤 바는 [Hide seen] [Filters (n)] 2버튼 + 바텀시트(ShareDock BottomSheet 패턴 재사용), 그리드 1열, 비교모드 가로 스와이프, 탭 트레이 유지.
- **접근성**: 브러시 키보드 조작, 토글 aria-pressed, 탭 트레이 role=tablist, 대비 AA.
- 신규 CSS는 `app/takescore/screener.css` 한 파일로(글로벌 오염 금지, cx-* 클래스는 단계적 대체).

---

## 6. 데이터·마이그레이션 계약 (구현 순서대로)

**신규 마이그레이션 1개** (`00xx_takescore_screener.sql` — 번호는 구현 시점 최신+1):
1. `film_provider_index` 테이블 + 인덱스 + `fpi_rebuild()` + 1회 실행 + RLS(read: using true — 공개 데이터).
2. `cinecodex_ranked` **v8**: drop 후 재생성 — 반환에 `imdb_rating, imdb_votes, rt, rank` 추가(rank는 `p_sort` 기준 window `row_number() over(...)` + offset 반영), 인자에 `p_providers int[], p_watch_country text, p_max_votes int` 추가. **grant execute to anon, authenticated, service_role 재부여**(drop이 grant를 날림).
3. `cinecodex_ranked_mine` v2: 동일 확장 + `p_mode 'only'|'exclude'`. **구 시그니처 drop.** grant는 **service_role만**(현행 유지 — RLS 우회 함수).
4. `cinecodex_histogram(...)`: ranked와 동일 필터 인자 → 20버킷 카운트. grant anon.
5. `provider_directory(p_country)`: 국가별 제공자 상위 30. grant anon.
6. 13차원 전역 분포는 마이그레이션 아닌 **서버 컴포넌트에서 1회 집계**(`cinecodex_film_subscores` 응용 또는 단순 `select width_bucket... group by` 뷰) — `unstable_cache` 24h.

**함수 레벨 `set statement_timeout`**: anon 3초 함정(tv에서 학습) — ranked/histogram에 `set statement_timeout to '8s'` 명시.

---

## 7. 구현 순서 (Phase — 각각 독립 배포 가능)

| Phase | 내용 | 완료 기준 |
|---|---|---|
| **P0** | 마이그레이션(§6) + `CodexExplorer`가 v8 RPC 소비(점수띠에 IMDb/RT, rank 표시). 호출부 전수 수정 | `/takescore` 기존 기능 무손실 + 행에 rank·IMDb 보임. tsc 신규에러 0 |
| **P1** | URL 상태 동기화 + 연도 since 칩 + 컨트롤 바 재배치 + Hide seen(4-D, API mode 패스스루) | `?since=2010&hide=seen` 링크 재현 동작. 비로그인 SSR HTML에 개인화 0 |
| **P2** | 블랙 히어로 + 즉답 검색(4-A) + 프리셋 칩(4-H) | 검색→탭 고정 동작. 히어로가 lh-h1 대체 |
| **P3** | 필름 탭 트레이 + 카드 패널 + 비교(4-B), Curtain 제거, `?pin=` 직렬화 | 탭 3개 고정→새로고침 유지→비교 표 렌더 |
| **P4** | 분포 브러시(4-E) + 그리드 v2 스타일(4-F) + PosterActions 배치 | DualRange 소멸. 포스터 w154. 모바일 바텀시트 |
| **P5** | 시청국×구독 필터(4-G) + My 탭 스트립(4-I) | KR+Netflix 선택 시 결과·로고 정확(스팟체크 3편을 TMDB 웹과 대조) |

각 Phase 후: `node node_modules/typescript/bin/tsc --noEmit` 신규 에러 0 → 커밋 → 라이브 검증(캐시버스터 필수 — ISR 함정).

---

## 8. 불변식·함정 (구현 AI 필독)

1. **서버 HTML 개인화 금지** — SSR/ISR 산출물은 전 사용자 동일. seen/watchlist/구독선택은 전부 클라이언트 fetch·localStorage. (렌즈 정본 불변식)
2. **점수는 읽기 전용** — `cinecodex.scores`는 LLM(Sonnet) 유료 채점. 어떤 재계산·재채점도 이 기획 범위 밖.
3. **create-or-replace 오버로드 함정** — 시그니처 바꾸는 함수는 반드시 구 시그니처 `drop function` 먼저. drop은 grant를 지우므로 **grant 재부여** 필수. `cinecodex_ranked_mine`은 service_role만.
4. **PostgREST 1000행 cap** — 페이징 유지. 히스토그램·디렉토리는 집계 반환이라 무관.
5. **unstable_cache는 배포를 넘어 산다** — 페이지/RPC 반환 shape 변경 시 캐시 키 범프.
6. **anon statement_timeout 3s** — 무거운 RPC는 함수 레벨 8s 명시.
7. **라이브 검증 함정 2종** — 배포 직후 구캐시(캐시버스터), React 주석 노드가 텍스트 쪼갬(href 속성으로 grep).
8. **워처 범위** — app/components/lib만 자동 커밋. supabase/·루트 문서는 수동 커밋. 다중 파일 편집 전 `touch .autodeploy-off`, 끝나면 제거.
9. **RPC-프론트 동시성** — kind/shape를 바꾸는 DB 변경은 프론트와 같은 배포 윈도우로(검색 v7에서 학습: 구 프론트가 신 shape에 500).
10. **SEO 보존** — 하단 서버렌더 풀랭킹 500·JSON-LD·canonical `/takescore`·13차원 링크는 어떤 Phase에서도 제거 금지. 히어로 도입 후에도 h1 1개 유지.
11. **미채점 274편**(비공개 Tier-2)은 랭킹·검색 즉답에서 "Not yet appraised" 처리 — 0점으로 표시하지 말 것.
12. **탭 트레이 localStorage 키** `mt-ts-tray`, 구독 `mt-watch-prefs` — 다른 키와 충돌 금지, 파싱 실패 시 무시(try/catch).

---

## 9. 오픈 결정 (원우 몫 — 구현 AI는 기본값으로 진행)

| 결정 | 기본값(이대로 구현) | 대안 |
|---|---|---|
| 메인(/) 승격 | **✅ 완료 (2026-07-11)** — 홈 히어로 직후 `ScreenerPromo`(band dark, 섹션 2a) 배치: SSR top-TS 포스터 스트립(딥링크 `?pin=`)+프리셋 칩+대형 CTA. 원우 지시로 승격 확정 | 홈 자체를 스크리너로 교체(미채택) |
| 페이지 부제 표기 | "TakeScore™ Screener" (브랜드 유지+계기 명칭) | "The Screener" 단독 |
| 시청국 기본값 | KR (사용자 다수) + 브라우저 `navigator.language` 힌트 | IP 지오 (비용·프라이버시로 비추천) |
| rent/buy 포함 여부 | 구독 필터는 flatrate/ads/free만 | rent/buy 토글 추가 |

---

## 10. 구현 AI가 먼저 읽을 파일

`app/takescore/page.tsx` · `components/CodexExplorer.tsx` · `components/PosterActions.tsx` · `components/LensProvider.tsx` · `app/api/lens/takescore/route.ts` · `supabase/migrations/0042_lens_mine_rpcs.sql`(ranked/mine 정본) · `supabase/migrations/0052_takescore_rank_all_scored.sql` · `components/WatchProviders.tsx`(제공자 jsonb 파싱 선례) · `app/film/[slug]/read.css`(rd-hero) · `lib/cinecodex_dims.ts` · `HANDOFF-마이필름-렌즈.md`(불변식) · 이 문서.
