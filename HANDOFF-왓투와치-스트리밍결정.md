# HANDOFF — What to Watch ("The Marquee") · 구독-중심 시청 의사결정 메뉴 (단일 정본)

> **✅ SHIPPED · 라이브 (2026-07-13). v1 → v2 리디자인까지 배포·검증 완료.** 이 문서가 정본.
> 라벨 **"What to Watch"** / 라우트 **`/what-to-watch`** / 편집 별칭 **"The Marquee"**. 나브 **Wander 그룹, TakeScore 옆**.
> 관련 정본: `HANDOFF-테이크스코어-스크리너.md`(엔진·데이터·RPC의 부모 문서), `HANDOFF-마이필름-렌즈.md`(개인화 불변식), `app/where-to-watch/`+`app/whereto/[slug]/`(자매 메뉴).
>
> **§0~§11은 원래 기획서(설계 근거·의도)이며 아래 "AS-BUILT"가 실제 구현 상태의 정본이다. 이 메뉴 작업은 AS-BUILT부터 읽을 것 — 중복 재구축 금지.**

---

## AS-BUILT (실제 구현 상태 — 정본, 2026-07-13)

**커밋:** v1 `5bae1e7` → v2 `571e099` → **v2.1 레이아웃 `105ff89`** (2026-07-13, 현재 라이브). 모두 main 직배포(fast-forward)·Vercel 프로덕션·`metatake.net/what-to-watch` 렌더 검증 완료.

### 파일 맵 (전부 실존)
- **페이지(서버·ISR 300s)** `app/what-to-watch/page.tsx` — 전역 top-TakeScore SSR(크롤 백본) + `MarqueeExplorer`에 위임. `wtw_countries()`로 시청국 목록.
- **클라이언트** `components/marquee/MarqueeExplorer.tsx` (정본) — **상단 필터 바(사이드바 폐기, v2.1)** + 2열 카드 그리드. 상태 전부 여기. 팝오버 3종(services·genres·options) 인라인 click-outside.
- `components/marquee/ServicesPicker.tsx` — **팝오버 토글**("My services ▾") → `wtw_services()` 로드 → **Subscription/Free/Rent 그룹** 라벨 멀티셀렉트(유튜브·무료 포함). 저장뷰 버튼이 바로 옆.
- `components/marquee/AccessBadges.tsx` — 카드 접근 뱃지(🟢Subscription/🔵Free/🟡Rent, 티어어 명시, VPN 시 국기).
- **스타일** `app/what-to-watch/marquee.css` (`.mq2*` 스코프) + `../takescore/screener.css` 임포트(FilmCardPanel `.scr-card*` + PosterActions `.pa*` 재사용).
- `lib/wtw_library.ts` (Kanopy=191·Hoopla=212), `lib/wtw_genres.ts` (18장르 vocab).
- **API** `app/api/lens/marquee/route.ts` (hide-seen exclude 미러, service_role `_mine`), `app/api/wtw/views/route.ts` (저장 뷰 GET/POST/DELETE).
- 나브 `components/home2/Nav.tsx` (Wander·TakeScore 옆), 사이트맵 `lib/sitemap-data.ts`.
- **커튼(펼침)** = `components/screener/FilmCardPanel.tsx` 재사용(cinecodex_card RPC — 실제 TakeScore 감정패널: 도넛+13차원+외부평점+제공자).

### DB (마이그레이션 2개, 프로덕션 적용·검증 완료)
- **0095_marquee_availability.sql** — `cinecodex_ranked`/`_mine` **v10**(+`p_watch_countries text[]`·`p_include_us_library boolean`), `film_availability()`(뱃지 장식 RPC), `wtw_countries()`, `fpi_rebuild()`에 rent/buy 편입(916,277행).
- **0096_wtw_redesign.sql** — **v11**(추가 tail: `p_genres text[]`·`p_dir text('asc'|'desc')`·`p_include_rent boolean`; 정렬 `director`/`country` 추가; **행에 `director_slug` 방출**), `wtw_services(p_country,p_per_group)`(라벨=구독/무료/렌트, YouTube·렌트스토어 포함, library 플래그), `wtw_saved_views` 테이블(own-row RLS).
- **⚠️ 불변식: v10/v11 신규 인자 전부 default → 기본값이 이전 버전과 동일 → Screener/`/api/lens/takescore`/기존 호출 무해(검증: 전역 total 6,704 불변·함수 오버로드 0).** 시그니처 변경 시 구 시그니처 `drop` 먼저(오버로드 함정). `_mine`은 service_role 전용.
- 라벨 규칙(wtw_services): flatrate≥30편 **또는** flatrate 우세 → subscription; 아니면 free/ads 우세 → free; 나머지 → rent. (count-argmax 순정은 wavve[구독+렌트]를 rent로 오분류 → 이 하이브리드로 교정. YouTube→rent, Kanopy/Hoopla→free 유지.)

### 기능 (원우 v2 + v2.1 피드백 전량 반영)
얇은 히어로+위트 한 줄(**흰색**) · **상단 필터 바**(국가 select · **My services 팝오버**+옆에 Save view/My views · **Genres 팝오버**(18) · 연도[**기본 2000+**] · 정렬+정순역순 · **Options 팝오버**[VPN·US도서관·hide-seen] · Reset) · **2열 카드**(TS **좌측** · **PosterActions는 포스터 오버레이**[별점/seen/watchlist가 포스터 위, 호버 노출 — `.pa`가 absolute inset:0 pointer-events:none] · 제목/연도 · 감독 링크[`director_slug ?? slugify`] · 접근뱃지 · **[Where to watch]**[/whereto/slug]·**[Details →]**[/film/slug] · 펼침=FilmCardPanel) · **정렬 5축**(TakeScore·연도·제목·감독·국가)×**정순/역순** · **저장 뷰**(로그인=이름붙인 프리셋 다중 `wtw_saved_views`+`/api/wtw/views`; 비로그인=브라우저 `mt-marquee-cfg` 자동기억).
- **⚠️ PosterActions는 반드시 position:relative 포스터 컨테이너 안에 둘 것**(standalone 렌더 시 `.pa-stars`가 세로로 튀어나오는 "이상한 별점 그리드" 버그 — v2.1에서 수정).

### 상태 원장 (중복/누락 방지)
- ✅ 완료: 위 전부. rent 포함(`p_include_rent`)은 **렌트-라벨 서비스를 선택했을 때만** 켜짐(YouTube 등).
- ⛔ 미구현(의도적): P4의 (선택)TS 분포 브러시 — 안 만듦(불필요 판단). "My 스트립"은 저장 뷰로 대체.
- ⚠️ 함정: SSR은 전역(개인화 0)·클라가 `mt-marquee-cfg`(풀 config)+`mt-watch-prefs`(country/providers, Screener와 공유) 로드 후 재랭크 · `film_availability`는 rent 뱃지를 **선택 provider가 p_providers에 있을 때만** 방출 · anon 8s statement_timeout · 배포순서 **마이그 먼저→코드 병합**(신규 RPC 없으면 라이브 500).
- ⚠️ **CSS 명시도**: 히어로 문단은 globals `.mt p { color: var(--ink) }`(0,1,1)가 이겨서 검정 히어로 위에 안 보임 → `.mq-hero2 .mq-witty`(0,2,0)로 흰색 강제(0096 후 105ff89→9881b2a 수정). `.mt` 래퍼 안 텍스트는 이 함정 주의.
- ⚠️ **국가 목록 SSR 신뢰 금지**: `wtw_countries` SSR 값이 (DB 과부하 시점 렌더→ISR 캐시로) 빈 배열로 굳어 국가 셀렉터가 옵션 0개가 될 수 있음 → **MarqueeExplorer가 SSR 목록 비면 클라이언트에서 `wtw_countries` 직접 fetch**(9881b2a). 셀렉터 min-width도 지정(플렉스 붕괴 방지).

---

## 0. 한 문장 정의

**`/what-to-watch` = The Marquee** — "나는 이 나라에서 이 서비스들을 구독한다"에서 출발해, **내가 지금 실제로 볼 수 있는 것 중 최고작을 TakeScore로 랭킹**해 표로 내려주는 의사결정 메뉴. 각 행에 **어디서·어떤 방식으로(무료/구독/유료)** 볼 수 있는지 뱃지. 안 본 것만 보기(제외) 또는 본 것 흐리게(하이브리드). VPN 보유자·미국 도서관(Kanopy/Hoopla) 접근까지 스위치로.

**Where to watch와의 차이(원우 정의):** Where to watch는 **영화 중심**("이 영화, 어디서 보지?" → 영화를 이미 안다). What to Watch는 **내 구독 서비스 중심**("내 서비스로 뭘 보지?" → 가용성에서 출발). 두 메뉴는 스트리밍 결정 문제의 두 반쪽 — 나브에서 이웃으로 둔다.

---

## 1. 포지셔닝 — 세 표면의 역할 분담 (혼동 금지)

| 표면 | 멘탈모델 | 입력 | 출력 |
|---|---|---|---|
| **`/takescore` (The Screener)** | "전 영화를 품질로 스크리닝" | 품질/차원 필터 | 6,701편 전역 랭킹. 구독 필터는 **여러 필터 중 하나**(§4-G) |
| **`/where-to-watch` + `/whereto/[slug]`** | "이 영화 어디서 보지?" (영화→가용성) | 영화 검색 | 그 영화의 국가별 스트리밍/대여/무료아카이브/디스크/자막 |
| **`/what-to-watch` (The Marquee) ← 신규** | "내 구독으로 뭐 보지?" (가용성→영화, 품질순) | **국가 + 내 서비스** | 그 조합에서 볼 수 있는 것만, TakeScore 랭킹 표 |

**핵심 통찰:** What to Watch가 필요로 하는 엔진의 90%는 **이미 Screener에 존재**(§2). 신규 작업의 본질은 (a) 그 엔진을 "가용성 우선" 멘탈모델의 **전용 앞문**으로 재포장하고, (b) 진짜 새 개념 2개 — **VPN(다국가)**·**미국 도서관(Kanopy/Hoopla)** — 를 얹고, (c) **rent/buy(유료) 뱃지** 갭을 메우는 것.

---

## 2. 보유 데이터·엔진 (전부 프로덕션 실존, 2026-07-12 라이브 검증)

| 자산 | 위치 | 규모/상태 | What to Watch에서의 쓰임 |
|---|---|---|---|
| **시청 제공자 정규화 인덱스** | `film_provider_index (film_id, country_code, provider_id, provider_name, kind)` | **279,312행 · 5,747편 · 139개국 · kind∈{flatrate,ads,free}** | 가용성 필터·뱃지의 백본 |
| TakeScore 점수 | `cinecodex.scores` (V/C/R + 13서브) | 6,701편, LLM 채점(유료·**읽기 전용**) | 랭킹 축 |
| 외부 점수 | `film_ratings` (imdb/rt/metascore) | 6,931편 | 행 보조 점수 |
| 랭킹 RPC | `cinecodex_ranked(... p_providers int[], p_watch_country text ...)` | v8 라이브 | **이미 단일국가×구독 필터 지원** — 확장만 |
| 개인화 랭킹 RPC | `cinecodex_ranked_mine(p_user, ..., p_mode 'only'|'exclude', ...)` | 라이브 (service_role 전용) | 안 본 것 제외/하이브리드 |
| 제공자 디렉토리 | `provider_directory(p_country text)` | 라이브 (국가별 상위 제공자) | "내 서비스" 멀티셀렉트 팝오버 |
| 히스토그램 | `cinecodex_histogram(...)` | 라이브 | (선택) TS 분포 브러시 |
| 제공자 로고·원본 jsonb | `film_watch_providers.results` | 6,974편 | rent/buy 추출원(아래 갭), 로고 |
| 개인 시청기록 | `user_movies (seen, watchlist, dismissed)` | RLS | 제외/하이브리드·저장 |
| 접근 심화(무료아카이브·MUBI국가차·디스크·자막) | `lib/access_enrichment.json` | 수백 편(검증본) | (선택) 특정 행 "무료" 근거 보강 |

### 2-a. 검증된 사실 (구축 전 근거)
- **미국 도서관 실현 가능:** US 인덱스에 `Kanopy`(kind=free, 1,379편) · `Hoopla`(free, 831편) 존재. 둘 다 **미국(및 일부 해외) 공공도서관 카드로 무료** 스트리밍하는 바로 그 서비스. `Criterion Channel`(flatrate, 788) 등 시네필 소스도 다수.
- **VPN(다국가) 스키마 변경 불필요:** `country_code`가 컬럼이므로 `country_code = any(array['US','KR','GB'])`로 즉시 다국가 질의. provider_id는 전역(Netflix=8 어디서나).
- **⚠️ 갭 1개 — rent/buy 부재:** 인덱스 kind는 `flatrate/ads/free`뿐. 사용자가 원한 "무료/유료/스트리밍" 3구분 중 **"유료(rent/buy)"가 인덱스에 없다**. `film_watch_providers.results` 원본 jsonb에는 rentnbuy가 있으므로 **`fpi_rebuild()`에 rent/buy unnest 추가**로 메운다(§6-1). 단, 유료는 **필터 축이 아니라 표시 뱃지**(§4-6).

---

## 3. IA — 페이지 구성 (위→아래)

```
┌──────────────────────────────────────────────────────────────┐
│ A. 블랙 히어로 (rd-hero 관례; Screener와 동일 문법)             │
│    크럼 "What to Watch" / H1 "What to Watch" (별칭 The Marquee) │
│    서브: "Pick your country and the services you pay for.       │
│          We rank the best you can actually watch right now."   │
├──────────────────────────────────────────────────────────────┤
│ B. ★셋업 바 (이 메뉴의 정체성 — 크고 뚜렷하게, sticky)          │
│    [🌍 Country: South Korea ▾]  ← 크게, 상단 지배적                │
│    [＋ My services ▾ : Netflix · Watcha · TVING (3)]           │
│    보조 스위치: [✈ I use a VPN] [🏛 US library (Kanopy/Hoopla)]  │
│    [● Hide what I've seen ○]  (로그인 시; 아니면 하이브리드 흐림) │
├──────────────────────────────────────────────────────────────┤
│ C. 요약 줄: "N films you can watch on your services · sorted    │
│    by TakeScore" + [정렬 ▾] + (선택) TS 분포 브러시             │
├──────────────────────────────────────────────────────────────┤
│ D. ★결과 표 (Screener 그리드 v2 재사용)                         │
│    #rank · 포스터 · 제목(연도·감독) + TS·IMDb·RT 점수띠         │
│    · [접근 뱃지: 🟢Streaming Netflix / 🔵Free Kanopy / 🟡Rent]   │
│    · [+watchlist / ✓seen]                                      │
├──────────────────────────────────────────────────────────────┤
│ E. (비어있을 때) "당신의 서비스엔 아직 매칭이 적어요" 폴백:       │
│    VPN/도서관 토글 유도 + 프리셋 국가/서비스 추천               │
├──────────────────────────────────────────────────────────────┤
│ F. My 스트립 (로그인 시): watchlist 중 "지금 볼 수 있는 것 n"    │
│    → /room 링크 (Screener §4-I와 동일 패턴)                    │
├──────────────────────────────────────────────────────────────┤
│ G. 크롤 백본: 국가별 대표 "Best on Netflix in KR" 등 서버렌더   │
│    정적 랭킹 스니펫(SEO — §7 오픈결정)                          │
└──────────────────────────────────────────────────────────────┘
```

**Screener와의 UI 차이(의도적):** Screener는 품질 필터가 지배하고 구독은 하위 드로어. What to Watch는 **국가+서비스 셋업 바가 페이지 최상단을 지배**하고, 품질/차원은 정렬·선택 필터로 후퇴. 같은 엔진, **뒤집힌 위계**.

---

## 4. 기능 스펙

### 4-1. 국가 선택 (지배적·상단)
- 셋업 바 최상단, 크게. 기본값: `localStorage 'mt-watch-prefs'.country` → 없으면 `navigator.language` 힌트(ko→KR) → 없으면 KR.
- 국가 목록: `film_provider_index`의 distinct country_code(139) 중 제공자 수 상위 ~40개 + 검색. 국기 이모지 + 영문명.
- 국가 바뀌면 "내 서비스" 목록도 그 국가의 `provider_directory(country)`로 리셋(단, 겹치는 provider_id는 선택 유지).

### 4-2. 내 서비스 멀티셀렉트
- `provider_directory(p_country)` 로고 그리드 팝오버. 해당 국가 flatrate/ads/free 상위 제공자(Netflix, Disney+, Watcha, TVING, wavve, Prime, Tubi…).
- 선택 = `localStorage 'mt-watch-prefs' = {country, providers:int[]}`. **로그인 불필요**, 재방문 유지. (Screener §4-G와 동일 키 — **공유**하면 두 표면이 서비스 설정을 공유. 권장.)
- 아무것도 안 골랐을 때: 기본 폴백 = 그 국가의 무료(free+ads) 소스 전체를 켠 상태로 결과를 보여줌("적어도 무료로 볼 수 있는 것").

### 4-3. VPN 토글 (신규 개념 — 다국가)
- `[✈ I use a VPN]` ON → 국가 셀렉터가 **다중 선택**으로 확장(예: KR + US + GB). 결과 = **선택 국가들 중 어디서든** 내 서비스에 있으면 포함. 각 행 뱃지에 **어느 나라 카탈로그인지 국기** 표기(예: 🟢 Netflix 🇺🇸).
- 데이터: 스키마 변경 없음. RPC를 `p_watch_country text` → `p_watch_countries text[]`로 확장(§6-2). 가용성 EXISTS 절이 `x.country_code = any(p_watch_countries)`.
- UX 주의: VPN은 회색지대 — 문구는 중립적으로("shown for reference; check the service's terms"). 각주 1줄.

### 4-4. 미국 도서관 토글 (신규 개념 — Kanopy/Hoopla)
- `[🏛 US library card]` ON → 결과에 **US의 Kanopy·Hoopla(kind=free)** 소스를 무조건 포함(선택 국가/서비스와 별개로 합집합). 뱃지 "🔵 Free · Kanopy (US library)".
- 구현: 가용성 합집합에 `(country_code='US' and provider_id in (<KANOPY_ID>,<HOOPLA_ID>))`를 OR로 추가. provider_id는 P0에서 `provider_directory('US')` 또는 인덱스에서 확정(이름 'Kanopy'/'Hoopla'로 조회 — TMDB 표준 id: Kanopy≈191, Hoopla≈212, **P0에서 실제 id 검증 후 상수화** `lib/wtw_library.ts`).
- 문구: "Free with a participating US public/university library card."

### 4-5. 안 본 것 제외 / 하이브리드
- `[● Hide what I've seen]` 토글. 로그인+시청기록 있을 때 활성. 구현은 Screener §4-D 그대로: `cinecodex_ranked_mine(p_mode 'exclude')` + `/api/lens/*` 미러(아래 §6-3). 비로그인/기록없음 → 툴팁 "Sign in & mark films seen → /me/import".
- **하이브리드**(기본, 토글 OFF일 때): 본 영화도 표에 남기되 행을 흐리게(dim) + "✓ Seen" 칩. LensToggle의 highlight 개념 차용하되 이 페이지 로컬 상태.
- **서버 HTML 개인화 금지 불변식**: SSR 초기 표는 항상 전역(로그인 무관). seen/제외는 클라이언트 fetch에서만.

### 4-6. 결과 표 + 접근 뱃지 (핵심 산출물)
- **행 = Screener 그리드 v2 재사용**(`components/screener/*` 또는 그리드 컴포넌트). #rank · 포스터 · 제목/감독/연도 · 점수띠(`TS · IMDb · RT`) · 저장버튼.
- **접근 뱃지(신규·이 메뉴 고유):** 각 행에 "어떻게 볼 수 있나"를 최대 2~3개 칩으로:
  - 🟢 **Streaming** — 내 구독(flatrate)에 있음 → `Netflix` 로고+이름
  - 🔵 **Free** — free/ads 소스 → `Kanopy`/`Tubi` 등
  - 🟡 **Rent/Buy** — (rent/buy 인덱스 확장 후) 유료 대여·구매만 가능
  - VPN 켜짐 시 국기 병기.
- **정렬 우선순위(뱃지 색):** Streaming(내 돈 이미 냄) > Free > Rent. 한 영화가 여러 방식이면 가장 "싼" 것 먼저.
- 뱃지 데이터는 **랭킹 RPC와 분리**해 **가시 행만 장식**(성능): `film_availability(p_slugs text[], p_countries text[], p_providers int[]) → {slug, tiers jsonb}` 배치 RPC 신설(§6-4). `cinecodex_for` 장식 패턴과 동형.
- 신선도 각주: `film_watch_providers.fetched_at` 최소값 → "Availability via JustWatch · TMDB, updated {date}".

### 4-7. 요약·정렬·(선택)브러시
- 요약: "**N** films you can watch on your services." (가용 총수는 랭킹 RPC의 count 또는 별도 count RPC).
- 정렬: TakeScore(기본, `p_sort='u'`) · IMDb · 최신. Screener 정렬 로직 재사용.
- (선택, P4) TS 분포 브러시 = `cinecodex_histogram` 재사용. 필수 아님.

---

## 5. 디자인
- **셋업 바가 주인공.** 국가 셀렉터를 페이지에서 가장 큰 인터랙션 요소로(히어로 바로 아래, 큰 pill). 금융 터미널의 Screener와 대비되는 "당신 설정 먼저" 온보딩 느낌.
- 색 체계: TS 그린 `#0F6E56` 계승. 접근 뱃지 = Streaming 그린 / Free 블루 계열 / Rent 앰버(중립). AA 대비.
- 히어로 배경: 결정적으로 고정한 TS 상위작 backdrop 1장(Screener 관례, ISR 일관성).
- 신규 CSS는 `app/what-to-watch/marquee.css` 한 파일(글로벌 오염 금지). 그리드/뱃지 클래스는 Screener `screener.css`에서 필요한 것만 재사용 or 미러.
- 모바일: 셋업 바 = 국가 pill + "Services (n)" + 토글 2개 → 바텀시트(ShareDock BottomSheet 패턴). 표 1열, 뱃지 줄바꿈.

---

## 6. 데이터·마이그레이션 계약 (신규 마이그레이션 1개, 번호는 구현시점 최신+1)

기존 시그니처(2026-07-12 확인):
- `cinecodex_ranked(p_sort, p_lambda, p_q, p_year_min, p_year_max, p_country, p_max_cost, p_sub, p_ts_min, p_ts_max, p_providers int[], p_watch_country text, p_max_votes, p_genre, p_limit, p_offset)`
- `cinecodex_ranked_mine(p_user, ..., p_mode text default 'only', ...)`
- `provider_directory(p_country text)` · `cinecodex_histogram(...)` · `fpi_rebuild()`

**변경/신설:**
1. **`fpi_rebuild()` 확장 — rent/buy 편입.** `film_watch_providers.results`에서 `rent`/`buy` 배열도 unnest해 `kind in ('rent','buy')` 행 추가. 인덱스 PK/구조 불변(kind에 값만 추가). 마이그레이션에서 1회 재실행. **⚠️ Screener의 구독 필터는 여전히 flatrate/ads/free만 필터해야 함** — rent/buy는 **뱃지 표시 전용**. 따라서 `cinecodex_ranked`의 가용성 필터 EXISTS 절에 `and x.kind <> all(array['rent','buy'])` 유지(구독 매칭에서 유료 제외), rent/buy는 §6-4 장식 RPC에서만 노출.
2. **`cinecodex_ranked` v9 (+`cinecodex_ranked_mine` v3): 다국가.** `p_watch_countries text[] default null` 인자 **추가**. 가용성 EXISTS 절을 `x.country_code = any(coalesce(p_watch_countries, array[p_watch_country]))`로. `p_watch_country`는 하위호환 유지. **US 도서관 합집합**을 위해 `p_include_us_library boolean default false` 추가 → true면 EXISTS 절에 `or (x.country_code='US' and x.provider_id = any(<library_ids>))`. **⚠️ 시그니처 변경 = 구 시그니처 drop 후 재생성 + grant 재부여**(create-or-replace 오버로드 함정). `_mine`은 service_role만, `ranked`는 anon/authenticated/service_role.
   - **호출부 전수 수정**: `/api/lens/takescore/route.ts`, `components/CodexExplorer.tsx`(Screener), 그리고 신규 What to Watch. 반환 shape 불변이면 Screener는 무해(신규 인자 default null). **shape 바꾸지 말 것** — 인자 추가만.
3. **`/api/lens/*` 패스스루**: 신규 `app/api/lens/marquee/route.ts`(또는 takescore 라우트에 `countries`,`us_lib` 쿼리 추가). Screener의 미러 패턴 복제. service_role로 `_mine` 호출(제외 모드).
4. **신규 `film_availability(p_slugs text[], p_countries text[], p_providers int[], p_include_us_library boolean) → table(slug text, tiers jsonb)`**: 가시 행 slug 배열을 받아 각 영화의 접근 뱃지 데이터(kind·provider_name·logo_path·country_code, rent/buy 포함)를 jsonb로. `film_provider_index` group by. grant anon. 함수 레벨 `set statement_timeout '8s'`.
5. **국가 목록**: 별도 RPC 불필요 시 `provider_directory` 확장 or `select distinct country_code, count(*) ...` 뷰 1개(`wtw_countries()` → {country_code, n_films, n_providers}). grant anon, ISR 캐시.

**함수 레벨 `set statement_timeout '8s'`** 신규/변경 RPC 전부(anon 3초 함정).

---

## 7. 재사용 지도 (Screener에서 lift)
| 필요 | 재사용원 |
|---|---|
| 결과 그리드 행·점수띠·저장버튼 | `components/screener/*`, `PosterActions` |
| 국가×구독 필터 로직·팝오버 | `ProviderPicker`(screener), `provider_directory` |
| 제외/하이브리드 | `cinecodex_ranked_mine` + `/api/lens/takescore` 미러, `LensProvider` 개념 |
| 히어로/블랙 톤 | `app/film/[slug]/read.css` `rd-hero` |
| localStorage 서비스 설정 | Screener `mt-watch-prefs`(공유) |
| 제공자 jsonb 파싱·로고 | `components/WatchProviders.tsx`, `AccessSummary.tsx` |
| 신선도/출처 표기 | `/whereto/[slug]` 각주 문구 |

---

## 8. 구축 순서 (Phase — 각 독립 배포 가능)

| Phase | 내용 | 완료 기준 |
|---|---|---|
| **P0** | 라우트 `app/what-to-watch/page.tsx` 골격 + 나브 등록(Wander, TakeScore 옆) + **Kanopy/Hoopla provider_id 검증→`lib/wtw_library.ts`** + `fpi_rebuild` rent/buy 확장 재실행 | 빈 페이지 라이브·나브에 "What to Watch" 보임·rent/buy 행 인덱스에 존재 |
| **P1** | 셋업 바(국가+내 서비스, localStorage) + `cinecodex_ranked` v9(다국가·us_library 인자) + 결과 표(Screener 그리드 재사용) | KR+Netflix 선택→그 조합 랭킹 표 렌더. 스팟체크 3편 TMDB 웹 대조 |
| **P2** | 접근 뱃지 = `film_availability` 장식 RPC(무료/구독/유료 3색) | 각 행 뱃지 정확(무료=Kanopy/Tubi, 구독=내서비스, 유료=rent) |
| **P3** | VPN 토글(다국가+국기 뱃지) + 미국 도서관 토글(Kanopy/Hoopla 합집합) | VPN ON→US 카탈로그 영화 국기와 함께 등장·도서관 ON→Kanopy 무료행 등장 |
| **P4** | 제외/하이브리드(`_mine` exclude + `/api/lens/marquee`) + My 스트립 + 빈결과 폴백 + (선택)브러시 + 크롤 백본 SEO | 로그인 제외 동작·비로그인 SSR 개인화 0·빈결과 유도 |

각 Phase 후: `node node_modules/typescript/bin/tsc --noEmit` 신규 에러 0 → 커밋 → 라이브 검증(캐시버스터).

---

## 9. 불변식·함정 (구축 AI 필독)
1. **서버 HTML 개인화 금지** — SSR/ISR은 전 사용자 동일. 국가/서비스/제외는 클라이언트+localStorage. (렌즈 정본 불변식)
2. **점수 읽기 전용** — `cinecodex.scores`는 유료 LLM 채점. 재계산 금지.
3. **create-or-replace 오버로드 함정** — 시그니처 바꾸는 RPC는 구 시그니처 `drop function` 먼저 + grant 재부여. `_mine`은 service_role만.
4. **rent/buy는 뱃지 전용, 필터 아님** — 구독 매칭(랭킹 포함 여부)은 flatrate/ads/free만. 유료를 랭킹 필터에 넣지 말 것(당신이 "가진" 게 아님).
5. **RPC-프론트 동시 배포** — 인자 추가는 default null이라 안전하지만, Screener·What to Watch 호출부를 같은 배포 윈도우로. 반환 **shape는 절대 바꾸지 말고 인자만 추가**.
6. **anon statement_timeout 3s** — 신규 RPC 함수 레벨 8s 명시.
7. **`mt-watch-prefs` 공유** — Screener와 같은 localStorage 키. 파싱 실패 try/catch 무시. 스키마 확장 시 두 표면 동시 점검.
8. **PostgREST 1000행 cap** — 표는 페이징(Load more). `film_availability`·`provider_directory`는 집계/장식이라 무관하나 slug 배열은 페이지 크기(≤60)만.
9. **워처 범위** — app/components/lib만 자동 커밋. `supabase/migrations`·루트 문서(이 파일)·`middleware`는 수동 커밋. 다중 파일 편집 전 `touch .autodeploy-off`, 끝나면 제거.
10. **VPN·도서관 문구 중립** — 법적 회색지대. "shown for reference / check terms", "requires a participating library card". 조장 문구 금지.
11. **신선도 표기 필수** — JustWatch/TMDB 출처 + updated 날짜 각주(정확성·법적).
12. **Where to watch와 혼동 금지** — 이 메뉴는 영화 검색이 주인공이 아님. 상단은 **국가+서비스 셋업**. 검색창을 넣더라도 보조.

---

## 10. 오픈 결정 (원우 몫 — 구축 AI는 기본값으로 진행)
| 결정 | 기본값 | 대안 |
|---|---|---|
| 나브 라벨/라우트/별칭 | **What to Watch / `/what-to-watch` / "The Marquee"** (확정) | — |
| 위치 | **Wander 그룹, TakeScore 옆** (확정: TakeScore → What to Watch → Where to watch 순) | Watch 그룹 flagship / 홈 밴드 승격 |
| 홈 승격 | 미적용(Phase 후 판단) | ScreenerPromo형 밴드 추가 |
| 시청국 기본값 | KR + navigator.language 힌트 | IP 지오(비용·프라이버시로 비추천) |
| 유료(rent/buy) 표시 | 뱃지로만 표시, 기본 결과에 rent-only 영화 **미포함**(구독 없으면 안 보임) | "Include rentable" 토글로 rent-only도 노출 |
| SEO 크롤 백본 | 국가×주요서비스 정적 스니펫("Best on Netflix in Korea") | 서비스별 별도 랜딩 라우트 |

---

## 11. 구축 AI가 먼저 읽을 파일
`HANDOFF-테이크스코어-스크리너.md`(부모·엔진) · `app/takescore/page.tsx` · `components/CodexExplorer.tsx` · `components/screener/*` · `components/ProviderPicker`(있다면) · `app/api/lens/takescore/route.ts` · `components/WatchProviders.tsx`·`AccessSummary.tsx` · `app/where-to-watch/page.tsx`·`app/whereto/[slug]/page.tsx`(자매 표면·문구) · `components/home2/Nav.tsx`(나브 등록) · `lib/access_enrichment.json` · `supabase/migrations/0070_*`(Screener RPC 정본) · `app/film/[slug]/read.css`(rd-hero) · 이 문서.
