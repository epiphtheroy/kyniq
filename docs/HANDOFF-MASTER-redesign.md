# HANDOFF · MASTER — Metatake 리디자인 시안 총정리

> **읽는 대상: 이 작업을 이어받아 실제 사이트에 반영할 다른 AI.**
> 지금까지 만든 **홈 + 5개 인덱스 페이지의 시안(컨셉 목업) 6개**를 한 문서로 묶었다.
> 이 문서 하나만 읽고도 (1) 각 시안이 무엇이고 (2) 무엇이 진짜이고 무엇이 자리표시자인지 (3) 실제
> 사이트의 어느 라우트·소스에 어떻게 반영하는지를 바로 알 수 있게 적었다. 경로는 전부 이 컴퓨터(macOS,
> 같은 Claude 프로젝트) 기준 **절대경로**다.

---

## 0. 한 줄 요약

`index-redesign-finals/` 안의 **6개 단일 HTML**은 metatake.net의 홈과 상단 메뉴 인덱스 페이지들을
**"조용한 학술 신문인데 몰래 살아 움직인다"** 라는 한 방향으로 다시 그린 **시안**이다.
**레이아웃·인터랙션·디자인 토큰은 그대로 가져가되, 카드/목록 안의 글·숫자·예시는 자리표시자이므로 실제
DB·페이지 내용으로 교체**한다. 모든 시안은 의존성 없는 단일 HTML이라 브라우저로 바로 열어 동작을 확인할 수 있다.

---

## 1. 산출물 위치 (이 6개가 본체)

폴더: `/Users/jerryje/Documents/MetaTake/index-redesign-finals/`

| # | 페이지 | 최종 파일 | 실제 라우트 | 한 줄 핵심 |
|---|---|---|---|---|
| 01 | **Home** (메인 · v6 "The Pair") | `01-home.html` | `/` | **첫 줄 = "AI 임베딩 기반 ≠ 생성 콘텐츠" 선언** · 히어로 = **안 어울리는 두 영화 + 빨강 선 + 공유 메타테이크(via 피겨)**, 박스형 전시 + **10개 페어 갤러리**(끊임없이 많다) · 개념 사슬(film→figure→take→meta-take) · 실시간 카운터 · 살아있는 별자리 · 진입문 · 매니페스토 |
| 02 | **Meta takes** | `02-meta-takes.html` | `/meta-takes` (허브 `/take/[slug]`) | 메타테이크 **정의 블록** · 회전 카드 덱(5분마다 새 4장) · "The catalogue" = 영화 썸네일 + **via [피겨]** · A–Z/Most films/Newest |
| 03 | **Directors** | `03-directors.html` | `/director` (`/director/[slug]`) | 작가 지문 — Signature **readings/tropes** 각각 **via [피겨]** + 대표작 백드롭 · A–Z/Nationality/Films 카탈로그 |
| 04 | **Films** | `04-films.html` | `/film` (`/film/[slug]`) | 백드롭 히어로 · **Meta takes via figure / Tropes via figure** 2열 · Movies-like(공유 의미 kin) · A–Z 점프바 3열 |
| 05 | **Tropes** | `05-tropes.html` | `/tropes` (`/trope/[slug]`) | figure-type 허브(틸 강조) · laconic + definition · Figures = 영화 썸네일 + **via [피겨]** · A–Z/Most films/Newest |
| 06 | **Latest / Trending** | `06-latest-trending.html` | `/latest` · `/trending` | 매거진형 — Latest는 **엔티티 5종 색박스 masonry + 무한 스크롤**, Trending은 **4영역(메타·테이크·트로프·영화) 랭킹 + 더보기** |

보관용 README: `/Users/jerryje/Documents/MetaTake/index-redesign-finals/README.md`
(상위 폴더 `/Users/jerryje/Documents/MetaTake/`에 중간 버전 v1~v5와 원본 파일명들이 남아 있다. 무시해도 된다.)

> **먼저 할 일:** 6개를 브라우저로 직접 열어 본다. 새로고침마다 피처가 랜덤으로 바뀌고, 카드 덱이 오른쪽으로
> 넘어가며, 카운터가 차오르고, Latest는 끝없이 더 불러오고, Trending은 4영역으로 순위가 보인다.

### ➕ 추가 카테고리 — Blog (아직 사이트에 없음 · 미리 디자인해 둠)

**Blog은 현재 metatake.net에 없는, 새로 추가되어야 하는 최상단 카테고리다.** 거의 매일 쓰는 일일 칼럼
**"Between Film and the World"**(그날의 뉴스를 영화·메타테이크 리딩으로 잇는 칼럼)를 위해, 사이트에 붙기 전에
디자인을 **미리 만들어 두었다.** **핵심 목적 = 이메일 구독 확보.** (Ghost 등 미사용 — 직접 기획·개발, 이메일만 서드파티.)

폴더: `/Users/jerryje/Documents/MetaTake/blog-design/` · 상세 = **§6B**.

| # | 페이지 | 파일 | 라우트(신규) | 한 줄 핵심 |
|---|---|---|---|---|
| 07 | **Blog index** | `07-blog-index.html` | `/blog` | 일일 칼럼 아카이브 · 칼럼 정체성 + **구독 카드(스티키)** · 오늘 에디션 피처(5운율=영화 썸네일+event→film+별점) · 최근 에디션 · 하단 구독 밴드 |
| 08 | **Blog post(읽기)** | `08-blog-post.html` | `/blog/[slug]` | 번호 랭크 엔트리(event→film·★별점·뉴스문단·**빨강 좌선 리딩**·"In Metatake" 디포짓·영화 스틸) · cutting-room floor · "Retrieved, not remembered" · 중간/끝 구독 |
| 09 | **Blog subscribe** | `09-blog-subscribe.html` | `/blog/subscribe` | 전용 구독 랜딩 · 큰 폼 + **더블 옵트인 성공 상태** · "받은 편지함 3가지" · 최근 에디션 미리보기 |

---

## 2. 상태 = 시안. "진짜"와 "가짜"를 먼저 구분하라

| | 그대로 가져갈 것 (진짜) | 교체할 것 (자리표시자) |
|---|---|---|
| **공통** | 디자인 토큰(§3) · 마스트헤드 구성(§3.1) · 인덱스 패턴(§4) · 인터랙션 메커니즘(§5) | 카드/목록 안의 제목·산문(laconic/thesis/definition)·숫자·register 키 |
| **데이터** | **via [피겨] 관계 구조** · 정렬/필터 로직 · 색 구분 체계 | 구체적 제목·편수·카운트·백드롭 경로(실시간 TMDB라 작동은 하나 큐레이션은 실데이터로) |

핵심 원칙: **"우리 사이트에 이미 있는 페이지의 스크린샷"처럼 보이게 만든다.** 지금은 그럴듯한 가짜이므로,
실제 DB/페이지 내용으로 바꾼다. **pitch·laconic·thesis·definition·cases를 추측으로 채우지 말 것.**

---

## 3. 공통 디자인 시스템 (절대 새로 만들지 말 것)

출처: `/Users/jerryje/Documents/MetaTake/app/globals.css` — 색·폰트는 전부 여기 토큰을 쓴다.

- 바탕 `#FFFFFF` · 잉크 `#0D0D0D` · 뮤트 `#6B6B6B` · 헤어라인 `#D8D8D8`/`#B9B9B9`
- **빨강 단 하나 `--accent:#E3120B`** — "빨강은 하나"가 정체성. 두 번째 강조색으로 늘리지 말 것.
- **트로프 영역만 틸 `#167C6B`** (figure-type 허브 색)
- 폰트: **PT Serif**(디스플레이/본문) + **Inter**(UI) · 사각 모서리 · 헤어라인 행 구분
- ⚠️ **이미지는 컬러로 둔다(흑백 처리 금지).** — 이전 홈 핸드오프의 "스틸 흑백" 지침은 폐기됨(사용자 지시로 변경). §9 참조.

### 3.1 마스트헤드 (상단 로고 + 메뉴) — 실제 사이트 기준, 02~06이 정답

출처: `/Users/jerryje/Documents/MetaTake/components/MetatakeNav.tsx`

- 로고 = **소문자 텍스트 워드마크 `metatake`** (`.brand`, 링크 `/`). 빨강 박스 아님.
- 메뉴 순서(정확히): **`Ask · Latest · Trending · Films · Directors · Tropes · Concepts · Meta takes`**
  링크: `/ask · /latest · /trending · /film · /director · /tropes · /concept · /meta-takes`
- 우측: **Search · Random(주사위 ▾) · Account**.
- ➕ **Blog 추가 시:** 메뉴 **맨 끝에 `Blog`(`/blog`)** 를 더한다 → `… · Meta takes · Blog`. (블로그 시안 3종은 이미
  이 형태로 그려져 있고, 블로그 페이지에서는 `Blog`에 빨강 active. 실제 반영 시 `MetatakeNav.tsx`에 항목 추가.)

> ✅ **6페이지 모두 이 마스트헤드로 통일됨.** (이전 v5 홈의 옛 `META/TAKE` 박스 로고·`Graph/About`·`Sign in`은
> v6에서 위 구성으로 교체 완료. 실제 React 반영 시에도 `MetatakeNav.tsx`를 그대로 쓰면 된다.)

---

## 4. 공통 패턴 — "인덱스 페이지 = 소개 + 랜덤 피처 + 카탈로그"

상단 메뉴를 눌러 들어가는 인덱스(02~05)는 **모두 같은 3단 구조**로 통일했다. "죽은 평면 목록"이던 기존
인덱스를 살리는 게 목적이다.

1. **차별점 소개** — 빨강 좌측선 블록. "이 엔티티가 무엇인지"를 효익 중심 1~2문장으로. (메타테이크 페이지에는
   **정의 블록**을 명시적으로 둔다.)
2. **랜덤 피처 카드 덱** — 4장이 오른쪽으로 넘어가는 회전 덱. **7초마다 회전 · 5분마다 새 4장(`newBatch`,
   300000ms) · hover 시 정지 · ↻/‹›/점으로 조작.** 이미지는 컬러.
3. **카탈로그(The catalogue)** — 정렬 탭(**기본 A–Z**, "The/A/An" 관사 무시) + **A–Z 점프바(sticky)** +
   **3칸 그리드** + **행 전체 클릭**. 각 행에는 그 엔티티가 참조하는 **영화 3~4편 + via [피겨]** 증거를 붙인다.

이미지는 카드 **오른쪽**, 텍스트는 왼쪽 정렬.

---

## 5. 공통 인터랙션 메커니즘 (함수 이름까지 그대로 재사용 가능)

다섯 시안이 같은 코드 골격을 공유한다. 실제 React로 이식할 때 이 동작을 그대로 살린다.

- **회전 카드 덱**(02~05): `buildDeck` · `pos()`/`relayout()` · `advance()`(앞 카드를 오른쪽으로
  `translate3d(135%,…) rotateY(-24deg)` 날림) · `reverse()` · `setFront()` · `renderDots()` · `newBatch()`.
- **카탈로그**(02~05): `sortKey()`(선행 "the/a/an" 제거) · `letterOf()` · `renderAz()`(점프바, `scrollIntoView`) ·
  `renderCat()` · `applyFilter()` · 그리드 `repeat(3,minmax(0,1fr))`.
- **Latest masonry**(06): CSS-grid `grid-template-columns:repeat(auto-fill,minmax(258px,1fr)); grid-auto-rows:10px;
  gap:18px`, JS `spanBox()`가 `grid-row-end: span N`(N=ceil((innerHeight+18)/28)) 계산, `.box.wide{grid-column:span 2}`.
  ⚠️ `.inner`에 `height:100%`를 주면 셀 높이를 재서 masonry가 깨진다 — 주지 말 것(이미 고친 버그).
- **무한 스크롤**(06 Latest): `#sentinel`에 `IntersectionObserver` → `appendBatch()`가 `nextBox()`로 엔티티
  타입을 순환하며 박스를 추가.
- **이미지 로드**: TMDB `image.tmdb.org/t/p/{w185|w342|w500}/<path>.jpg`, onload 시 `.on` 클래스로 페이드 인.
- **랜덤/실시간**(01): `runCounters`(0→목표 카운트업) · `liveTick`(Takes/Nodes 가끔 ↑) · `rollFilm/rollMeta`(랜덤
  피처) · `streamDots`(참조 영화 점점점) · `refreshLists`(Just added 7초 순환) · Film⇄Figure 포스 그래프.

---

## 6. 페이지별 상세 — (무엇 / 진짜·가짜 / 어디에 반영)

### 01 · Home `01-home.html` (v6 "The Pair") → `/`  (실제 소스: `app/page.tsx`)

홈은 **완전히 새로 기획됨**(이전 v5 "Living Paper"를 대체). 목표 4가지를 페이지가 나눠 담는다: **아하 모멘트 ·
정확한 개념 전달 · 계속 눌러보게 함 · 프로젝트에 대한 선한 인상.** 톤은 "대담하지만 여전히 종이"(흰 종이·세리프·
빨강 하나 규율 유지 + 큰 히어로·모션·컬러 스틸).

**위→아래 구성(7개 블록):**

1. **첫 줄 = 메서드 선언 바(`.basis`)** — 마스트헤드 바로 아래 **맨 첫 줄**. ▦ + *"Built on AI embeddings — not
   AI-generated content. 모델은 의견을 쓰거나 영화를 지어내지 않는다. 실제 영화·피겨·리딩을 의미 공간의 점으로
   바꿔 어떤 작품이 은밀히 운율을 이루는지 **측정**할 뿐. 읽기는 비평이고, AI는 그것을 찾아내는 도구다."*
   → **이 사이트가 "AI가 생성한 콘텐츠(slop)"가 아니라 "AI를 분석 도구로 쓴 비평"임을 첫 줄에서 못 박는다. 핵심
   대비 = 생성(generate)이 아니라 측정(measure).** (사이트 전역 메시징 원칙 — §6-끝 박스 참조.)
2. **히어로 = 안 어울리는 두 영화의 연결(아하 엔진)** — 박스형 **전시(`.exhibit`)**(검은 테두리 + 상단 띠
   "FEATURED LINE · NN / 10" + 조작). 안에 좌/우 영화(컬러 백드롭·제목·년도·감독·**via [피겨]**)와 가운데
   **메타테이크에서 양쪽으로 그어지는 빨강 선** + laconic + "Open this reading →". **9초 자동 회전 · hover 정지 ·
   Another · 점.** "둘은 사실 같은 영화"임을 시각적으로 증명.
3. **10개 페어 갤러리(`.gallery`)** — 전시 박스 아래 **10개 박스**(5열). 각 박스 = 두 영화 썸네일 + 가운데 빨강
   선 + 메타테이크 + "A ⟷ B". 클릭 시 전시 박스로 로드. 헤더 카피로 규모 강조("…152 meta-takes, 13,241 readings
   underneath. 매일 밤 다시 그려진다"). → **"끊임없이 많다"는 인상 = 선한 인상 + 계속 클릭.**
4. **개념 사슬(정확한 개념 전달)** — "Not reviews. Not ratings. **Readings**." + **Film → Figure → Take →
   Meta-take** 4칸(각 정의 + 살아있는 예시: Black Swan → Nina의 변형 → Psychoanalytic → The Flesh That Changes
   Shape) + Meta-take 칸은 "the hub" 강조. 아래 **10개 register 칩**.
5. **스케일/엔진(선한 인상)** — 6 게이지(Films/Figures/Takes/Meta-takes/Tropes/Nodes, 카운트업+가끔 ↑틱) +
   임베딩 설명("…cosine distance로 영화 간 운율을 찾는 대규모 AI 프로젝트"). **과장 숫자 제거**(soft edges/0.86
   삭제, `text-embedding-3-small · 1,536 dims · cosine k-NN`만 — 사실).
6. **살아있는 별자리(계속 클릭)** — 검은 캔버스 그래프(유일하게 색이 빛나는 곳), **Films⇄Figures 토글**, 드래그·
   줌·클릭. 히어로 페어들이 별로 연결돼 보임.
7. **진입문 + Just added + 매니페스토** — 4개 문(Meta takes/Tropes/Directors/Concepts, 각 회전 샘플) · Just added
   티커(7초) · 선한 매니페스토("…unconscious lines… 실타래를 건넨다. 리뷰도 점수도 순위도 없다").

- **진짜(그대로):** 7블록 레이아웃 · 페어 히어로 메커니즘 · 박스 구획 · 10-갤러리 · 개념 사슬 · 카운터/그래프 ·
  메서드 선언 바 카피 · 디자인 토큰 · 마스트헤드(이미 올바름).
- **진짜(데이터):** **10개 페어는 모두 실제 metatake 메타테이크 관계**(영화·figure·laconic·백드롭) — §6-끝 표.
- **가짜→교체:** 카운트(567/4,626/13,241/152/96/5,441) → 실제 카운트(`home_payload`). register 칩은 §7 매핑(이미 일치).
  진입문 회전 샘플·Just added 항목 → 실제 최신 데이터. 페어는 시안용 큐레이션 10개이므로 실연동 시
  `meta_take_rankings`/임베딩 nearest-neighbour로 **실제 페어를 뽑아** 교체(아래 데이터는 검증된 시드).
- **데이터 소스:** `home_payload` RPC(카운트·최신) · 페어/별자리는 임베딩 nearest-neighbour(cosine) 결과 또는
  `meta_take_rankings`의 defining cases 2편 · 그래프는 `NodeGraph` 혹은 동봉 `film-graph-obsidian.html`/
  `figure-graph-obsidian.html` 재사용.

**▷ 히어로 10개 페어 (검증된 실제 시드 — `PAIRS` 배열에 그대로 있음):**

| # | 메타테이크 (공유 개념) | 영화 A — via 피겨 | 영화 B — via 피겨 |
|---|---|---|---|
| 1 | Architecture as Social Hierarchy | Parasite (2019) — the semi-basement window | The Favourite (2018) — the fisheye lenses |
| 2 | Flesh Reduced to Persistence | The Revenant (2015) — the bear-mauling shot | Die Hard (1988) — crawling through air ducts |
| 3 | The Doubled Self as Confession | TÁR (2022) — Lydia Tár's disintegration | Three Colours: Blue (1993) — Julie severing the past |
| 4 | Saturated Hues as Emotional Diagnosis | Bad Education (2004) — the saturated red | The Neon Demon (2016) — neon, synth-scored surfaces |
| 5 | The Sign That Refuses Meaning | Pulp Fiction (1994) — the glowing briefcase | Halloween (1978) — Myers's motiveless evil |
| 6 | The Flesh That Changes Shape | Black Swan (2010) — Nina's bodily mutations | Videodrome (1983) — the abdominal slit |
| 7 | The Repeating Day | Groundhog Day (1993) — the 6 a.m. loop | Run Lola Run (1998) — the three runs |
| 8 | The Land That Does Not Care | Gravity (2013) — the turning Earth | There Will Be Blood (2007) — sun-bleached hills |
| 9 | The Climactic Performance | Whiplash (2014) — the final drum solo | Bohemian Rhapsody (2018) — the Live Aid reenactment |
| 10 | The Monstrous-Feminine | Carrie (1976) — the prom-night blood | The Girl with the Needle (2024) — Dagmar the ogress |

(백드롭은 TMDB 경로 — `PAIRS` 배열의 `bd` 필드. 9·10번 등 일부는 Supabase `films` 테이블에서 확보.)

> **★ 사이트 전역 메시징 원칙 (홈 첫 줄에서 시작, 모든 카피에 적용):**
> metatake는 **"AI가 생성한 콘텐츠"가 아니라 "AI 임베딩을 분석 도구로 쓴 비평"**이다. 카피·About·메서드 설명
> 어디에서도 *AI가 글을 썼다/영화를 만들었다*는 인상을 주지 말 것. 항상 **AI = 측정·연결의 도구**, **읽기 =
> 비평**으로 분리해 표현한다. (홈 `.basis` 바의 문구를 표준 카피로 재사용 권장.)

### 02 · Meta takes `02-meta-takes.html` → `/meta-takes`  (허브 `app/take/[slug]/page.tsx`)
- **무엇:** H1 "Meta takes" + **메타테이크가 무엇인지 정의 블록** · 회전 카드 덱 · "The catalogue"(메타테이크
  카탈로그임을 라벨에 명시) — 각 행 = 메타테이크 + 영화 썸네일 3~4 + **via [피겨]**, 행 전체 클릭 → `/take/[slug]`.
  정렬 탭 A–Z(기본)/Most films/Newest + A–Z 점프바 + 3열.
- **가짜→교체:** title/laconic/thesis/defining cases → 실제 `meta_takes` + `meta_take_rankings`. **register 배지는
  §7 실제 매핑** 사용(시안 값 폐기).

### 03 · Directors `03-directors.html` → `/director`  (`app/director/[slug]/page.tsx`)
- **무엇:** H1 "Directors" + 작가 지문 소개 · 덱 카드 = **Signature readings + Signature tropes 각각 via [피겨]** +
  대표작 백드롭 · 카탈로그 A–Z(기본)/Nationality/Films + 점프바 + 3열.
- **로직 주의:** "signature"는 실제 감독 페이지처럼 **그 감독 필모 중 ≥2편에서 반복되는** 메타테이크/트로프로
  계산한다(임의 선정 아님).
- **가짜→교체:** 감독별 시그니처·via·대표작 → 실제 데이터.

### 04 · Films `04-films.html` → `/film`  (`app/film/[slug]/page.tsx`, figure `…/figure/[figureSlug]`)
- **무엇:** H1 "Films" + 소개 · 덱 카드 = 백드롭 히어로 + **Meta takes via figure / Tropes via figure 2열** +
  **Movies-like**(공유 의미 kin) · 카탈로그 A–Z(기본)/Genre/Year(decade) + 점프바 + 3열, 제목 옆 **(년도)** 표기.
- **가짜→교체:** 영화별 via-figure 묶음·kin → 실제 데이터. figure 링크는 `/film/[slug]/figure/[figure-slug]`.

### 05 · Tropes `05-tropes.html` → `/tropes`  (`app/trope/[slug]/page.tsx`)
- **무엇:** H1 "Tropes"(figure-type 허브, **틸 강조**) + laconic + definition · Figures = 영화 썸네일 + **via [피겨]** ·
  카탈로그 A–Z(기본)/Most films/Newest + 점프바 + 3열.
- **가짜→교체:** 트로프별 laconic/definition/figures → 실제 `/trope` 데이터.

### 06 · Latest / Trending `06-latest-trending.html` → `/latest` · `/trending`
- **Latest(매거진):** featured 프론트 + **엔티티 5종 색박스 masonry**(다양한 크기) + **무한 스크롤**.
  각 박스에 **엔티티 색 밴드**를 둬서 사이트 구조가 한눈에 보이게 했다. 박스 타입: 영화·메타테이크·트로프·
  감독·컨셉(+개별 리딩/take). 색 = §8.
- **Trending(랭킹):** **4영역으로 분할 — Meta takes · Takes(리딩) · Tropes · Films.** 각 영역은
  **순위 + 더보기(더보기 → 각 메인페이지)**. **순위 안의 내용은 글이 아니라 영화들 · via 피겨**다(각 피처 페이지의
  결과처럼):
  - Meta takes(빨강 `#E3120B`): 순위 + 메타테이크 + 공유 영화 수 + **영화 3개(via 피겨) 스트립** → `/meta-takes`
  - Takes(자주 `#A8434F`): 순위 + register + figure + 영화 + **본문 스니펫 2줄** + → 메타테이크 + 썸네일 → `/latest`
  - Tropes(틸 `#167C6B`): 순위 + 트로프 + figures/films + **영화 스트립** → `/tropes`
  - Films(짙은 `#26303B`): 순위 + 백드롭 + 제목/감독 + **figure→reading via** → `/film`
- **가짜→교체:** 랭킹·편수·스니펫 → 실제 `/trending`(예: `meta_take_rankings`, trending RPC). via 구조는 유지.
- **JS:** `setMode`(Latest/Trending 토글) · `buildTrending` · `trendCard`/`filmRankCard`/`takeRankCard` ·
  masonry `spanBox/spanAll` · `nextBox`/`appendBatch`(무한 스크롤).

---

## 6B. ➕ 추가 카테고리 — Blog (`/blog`) · 미리 만들어 둔 디자인

**Blog은 아직 metatake.net에 없는, 새로 추가될 최상단 카테고리다.** 거의 매일 올릴 일일 칼럼
**"Between Film and the World"** — *그날의 실제 뉴스 5건을, 그것과 가장 강하게 "운율(rhyme)"하는 영화 + 메타테이크
리딩에 잇는* 칼럼 — 을 위해 사이트에 붙기 전 디자인을 선제작했다. **목적은 이메일 구독 확보.** 폴더
`/Users/jerryje/Documents/MetaTake/blog-design/` (07·08·09 + README).

> **왜 사이트와 맞는가:** 이 칼럼의 동작은 **v6 홈의 "안 어울리는 두 영화 연결"과 동일**하다 — *사건 ⟷ 영화*,
> figure로 연결, **운율 강도 = ★별점**, 그리고 **"링크 전 라이브 DB에서 확인"**(=생성이 아니라 검색,
> "Retrieved, not remembered"). §6의 AI-임베딩 메시징 원칙을 블로그가 그대로 구현한다.

### 3개 디자인
- **07 · `/blog` (index)** — 칼럼 정체성 헤더 + **구독 카드(스티키, 우측)** · "Today's edition" 피처(5운율 =
  영화 썸네일+event→film+★) · 최근 에디션 리스트(썸네일 스트립) · 하단 구독 밴드.
- **08 · `/blog/[slug]` (읽기, 센터피스)** — 일일 에디션 본문. 아래 "포스트 포맷" 그대로.
- **09 · `/blog/subscribe`** — 전용 구독 랜딩 + **더블 옵트인 성공 상태** + "받은 편지함 3가지" + 에디션 미리보기.

### 포스트 포맷(반드시 보존할 구조) — `/blog/[slug]`
1. 칼럼 헤더(제목 "Between Film and the World" + 부제 + 날짜 + 인트로).
2. **번호 랭크 엔트리 ×5**, 각: ① 이벤트 헤드라인 ② **`이벤트 → 영화 · ★★★★☆ rhyme`** 라인 ③ **뉴스 문단**
   (외부 출처 링크) ④ **리딩 문단**(빨강 좌선, 내부 metatake 링크, `<em>`로 figure 강조) ⑤ **"→ In Metatake:"
   디포짓 라인**(이 운율이 맵에 남기는 엣지).
3. **"On the cutting-room floor"** — 큰 뉴스지만 운율 약해 버린 것(이유 + "Cut").
4. **"How this was made"** — 방법 각주, 끝맺음 *"Retrieved, not remembered."*
5. 구독(중간 인라인 1 + 끝 박스 1) + `[Subscribe] · [Wander Metatake →]`.

### 링크 스타일(중요) — 내부/외부 구분
- **내부 metatake 링크(`.lk-in`) = 빨강**(`/film/[slug]`, `/take/[slug]`). **외부 뉴스 출처(`.lk-out`) = 잉크
  밑줄 + `↗`**. 한 글에 둘이 많이 섞이므로 반드시 시각 구분.

### 이메일 구독 (= 핵심)
- **균형 배치**(사용자 선택): index 히어로 + 글 중간 인라인 + 글 끝 박스 + 전용 페이지. 팝업 없음.
- **폼은 프로바이더 무관**으로 설계 — 빌드 시 **Buttondown / ConvertKit(Kit) / Substack** 중 택1 후 폼 action/임베드
  교체(각 파일 `</script>` 위 주석에 방법 명시). 09는 **더블 옵트인 확인 화면**까지 그려둠.
- 디자인 토큰·마스트헤드(+Blog)·컬러 이미지·이미지 우측 정렬은 본 사이트와 동일.

### 진짜 vs 자리표시자
- **진짜:** 08의 본문(사용자가 실제로 쓴 에디션) · 영화·리딩·**라우트**(`/film/bacurau-2019`,
  `/take/state-of-exception` 등) · 백드롭(Supabase `films`) · 외부 뉴스 링크.
- **자리표시자:** index의 과거 에디션 행, 구독자 수 문구 → 실연동 시 실제 글·서드파티 구독 수로 교체.

### 빌드 TODO (디자인 밖, 다른 AI가 할 일)
이메일 서드파티 선택·연결 · **일일 발송용 이메일 HTML 템플릿 별도 제작**(폼만큼 중요) · `/blog`·`/blog/[slug]`·
`/blog/subscribe` 라우트 + 글 소스(마크다운/CMS) · `MetatakeNav.tsx`에 **Blog** 추가 · 칼럼 자동화(매일 5건 매칭은
실제 임베딩/DB 조회로, 시안의 별점·운율은 그 결과로 채움).

---

## 7. Register(레지스터) 색·라벨 — 실제 매핑 그대로 사용

출처: `app/take/[slug]/page.tsx`의 `REG`. 시안의 register 키/색은 폐기하고 아래를 쓴다.

```
formal            Formal            #5B8FB9
semiotic          Semiotic          #B8860B
psychoanalytic    Psychoanalytic    #A8434F
ideological        Ideological       #C0392B
politico_economic Politico-economic #2E7D5B
philosophical     Philosophical     #7E57C2
existential       Existential       #546E7A
mythic            Mythic            #A9743B
genealogical      Film-historical   #2E86C1
reception         Reception         #159A8A
```

---

## 8. 엔티티 색 — Latest/Trending 구획 구분용

사이트 구조(어느 영역인지)를 색으로 즉시 보이게 하기 위한 매핑. (메타테이크는 빨강 정체성과 일치.)

```
film       #26303B   (짙은 슬레이트)
meta-take  #E3120B   (빨강)
take/리딩  #A8434F   (자주 — psychoanalytic 계열 톤)
trope      #167C6B   (틸)
director   #6B4E9E   (보라)
concept    #2E6F8E   (청록-블루)
```

---

## 9. 엔티티 모델 · 라우트 레퍼런스 (이걸 이해해야 시안을 못 망친다)

엔티티 흐름: **`film → figure → take(reading) → meta-take`**(메타테이크 = 같은 읽기가 여러 영화를 가로지를 때
떠오르는 허브 = **사이트의 주인공**), 거기에 **`trope`**(figure-type 허브)·**`director`**·**`concept`**(비평
이론/개념).

| 엔티티 | 의미 | 라우트 |
|---|---|---|
| film | 영화 | `/film/[slug]` (목록 `/film`) |
| figure(형상) | 영화가 반복해 돌아오는 구체 요소(사물·몸짓·색·인물·트로프·형식) | `/film/[slug]/figure/[figureSlug]` |
| take(밝힘/reading) | 한 figure에 대한 가까이 읽기 1개(근거 필수, register 분류) | (figure 페이지 내 카드) |
| meta-take(허브) | 여러 영화를 가로지르는 연결 개념 = 주인공 | `/take/[slug]` (목록 `/meta-takes`) |
| trope | figure-type 허브 | `/trope/[slug]` (목록 `/tropes`) |
| director | 감독 | `/director/[slug]` (목록 `/director`) |
| concept | 비평 개념/이론 | `/concept` |
| **blog**(➕ 신규) | 일일 칼럼 "Between Film and the World" | `/blog` · 글 `/blog/[slug]` · 구독 `/blog/subscribe` |
| 기타 | Ask · Latest · Trending · Genre | `/ask` · `/latest` · `/trending` · `/genre` |

권위 문서: `/Users/jerryje/Documents/MetaTake/MASTER.md`, IA: `…/site-ia-plan.md`,
영화 피처 스키마: `…/film-features-plan.md`.

> **브랜드 주의:** 코드/문서에 사이트명 **FilmCurio**와 제품 개념 **Metatake**가 혼재. 상단 워드마크는 현재 코드
> 기준 소문자 `metatake`. 표준화는 미정이니 **임의로 정하지 말고 `MetatakeNav.tsx`를 따른다.** (프로젝트 폴더도
> 과거 `filmcurio` → 현재 `MetaTake`로 바뀌었으니 옛 문서의 `…/filmcurio/…` 경로는 `…/MetaTake/…`로 읽는다.)

---

## 10. 먼저 읽을 소스 (순서대로)

1. `index-redesign-finals/` 6개 시안 — 브라우저로 동작 확인 (대상물)
2. `components/MetatakeNav.tsx` — 진짜 로고·메뉴(§3.1)
3. `app/globals.css` — 디자인 토큰(절대 새로 만들지 말 것)
4. `app/page.tsx` — 실제 홈(데이터 RPC `home_payload`)
5. `app/film/[slug]/page.tsx` + `film-features-plan.md` — 영화 피처(04·01)
6. `app/take/[slug]/page.tsx` — 메타테이크 + **register 매핑(§7)** (02·06)
7. `app/trope/[slug]/page.tsx` — 트로프(05)
8. `app/director/[slug]/page.tsx` — 감독 시그니처 로직(03)
9. `MASTER.md` · `site-ia-plan.md` — 전체 개념·IA(맥락)

---

## 11. 반영 순서 (이대로 따라 하면 된다)

1. **마스트헤드 통일** — `MetatakeNav.tsx` 기준으로 6페이지 상단을 1:1로(홈 v6는 이미 일치).
2. **디자인 토큰 연결** — 모든 색·폰트를 `globals.css` 토큰으로(새 색 금지, 빨강 하나·트로프 틸 유지).
3. **데이터 와이어링** — 페이지별 §6의 "가짜→교체"를 실제 RPC/쿼리로:
   홈(`home_payload` 카운트 + 페어/별자리는 임베딩 nearest-neighbour 또는 `meta_take_rankings` defining cases) →
   메타테이크(`meta_takes`+`meta_take_rankings`) → 영화(`film_features`+figures+kin) →
   감독(≥2편 반복 시그니처) → 트로프(`trope`) → Latest/Trending(trending RPC).
4. **register 배지 → §7 실제 매핑**, **엔티티 색 → §8**.
5. **메커니즘 이식**(§5) — 회전 덱·카탈로그(A–Z 점프/3열/정렬)·masonry·무한 스크롤·실시간 카운터·그래프.
6. **➕ Blog 추가**(§6B) — 나브에 `Blog` 추가 · `/blog`·`/blog/[slug]`·`/blog/subscribe` 라우트 · 이메일 서드파티 연결
   · **일일 발송 이메일 템플릿 제작** · 칼럼 매칭은 실제 임베딩/DB로.
7. **유지 검증**(§12).

---

## 12. 인수 체크리스트 (완료 기준)

- [ ] 6페이지 상단이 모두 소문자 `metatake` 워드마크 + `Ask·Latest·Trending·Films·Directors·Tropes·Concepts·Meta takes` + Search·Random·Account다. (홈 v6 포함 통일됨)
- [ ] **홈 첫 줄(`.basis`)에 "AI 임베딩 기반 ≠ 생성 콘텐츠" 선언**이 있고, 전역 카피가 *AI=측정·도구 / 읽기=비평*으로 분리돼 있다.
- [ ] **홈 히어로 = 안 어울리는 두 영화 + 빨강 선 + 공유 메타테이크(via 피겨)**, 박스형 전시 + **10개 페어 갤러리**(자동 회전·클릭 로드)가 동작한다.
- [ ] 빨강(#E3120B)은 UI에서 절제되어 쓰이고, 트로프 영역만 틸(#167C6B)이다. 새 색 없음.
- [ ] **이미지는 컬러**다(흑백 처리 없음).
- [ ] 인덱스(02~05)가 "소개 + 회전 피처 덱(7초 회전/5분 새 4장/hover 정지) + 카탈로그(A–Z 기본·관사 무시·점프바·3열·행 클릭)" 패턴을 지킨다.
- [ ] 카탈로그·카드의 **via [피겨]** 증거가 실제 관계 데이터다(지어내기 0).
- [ ] register 배지가 §7 키·라벨·HEX와 일치한다.
- [ ] Latest = 엔티티 색박스 masonry + 무한 스크롤. Trending = 4영역(메타·테이크·트로프·영화) 랭킹 + 더보기→각 메인. **순위 안은 글이 아니라 영화·via 피겨**(Takes만 본문 2줄 노출).
- [ ] 홈의 실시간 카운터·살아있는 별자리(Films/Figures 토글)·페어 자동회전·Just added 티커가 동작한다. 과장 숫자(soft edges/0.86 등)는 제거됨.
- [ ] 라우트가 실제와 일치: 메타테이크 `/take/[slug]`·목록 `/meta-takes`, 트로프 `/trope/[slug]`·`/tropes`, 영화 `/film/[slug]`·`/film`, 감독 `/director/[slug]`·`/director`.
- [ ] ➕ **Blog 추가됨**: 나브에 `Blog`, `/blog`·`/blog/[slug]`·`/blog/subscribe` 동작. 포스트 포맷(event→film·★·뉴스/리딩/디포짓·cutting-room floor·"Retrieved, not remembered") 보존. 내부=빨강·외부=↗ 링크 구분.
- [ ] **이메일 구독**이 균형 배치(index 히어로+글 중간+글 끝+전용 페이지)로 동작하고, 서드파티(Buttondown/ConvertKit/Substack) 폼이 연결됐다. **일일 발송 이메일 템플릿**도 별도로 있다.

---

## 13. 하지 말 것 (가드레일)

- 빨강을 두 번째 강조색으로 늘리지 말 것. "빨강은 하나"가 정체성.
- 이미지를 흑백 처리하지 말 것(컬러 유지 — 이전 홈 지침에서 변경됨).
- 라우트·엔티티 용어를 새로 발명하지 말 것(§9 표가 정답).
- pitch/laconic/thesis/definition/cases·via 피겨를 **추측으로 채우지 말 것** — 반드시 실제 데이터.
- 시안의 가짜 숫자(임베딩 soft edges/0.86 등)를 그대로 게시하지 말 것.
- Trending 순위를 산문으로 되돌리지 말 것 — 영화·via 피겨가 들어가야 한다(Takes의 2줄 스니펫만 예외).
- 회전 덱·점프바·masonry·무한 스크롤·**홈 페어 히어로/10-갤러리**를 평면 목록으로 후퇴시키지 말 것(살리는 게 목적).
- **홈을 "AI가 만든 콘텐츠"처럼 보이게 하지 말 것** — AI=측정·연결 도구, 읽기=비평으로 분리(§6 메시징 원칙).
- 홈 페어는 **실제로 같은 메타테이크를 공유하는 두 영화**여야 한다(아무 두 영화나 빨강 선으로 잇지 말 것).
- **블로그의 사건↔영화도 추측 금지** — 모든 영화·리딩은 **링크 전 라이브 DB에서 확인**(no dead ends, no invented hubs). 내부 metatake 링크와 외부 뉴스 링크를 한 스타일로 섞지 말 것(빨강 vs ↗).

---

### 부록 — 직전까지의 사용자 피드백(반영 완료, 유지할 결정들)
- "정의를 내려라" → 메타테이크 페이지에 정의 블록 추가.
- "랜덤 피처는 계속 업데이트 + 이미지 컬러" → 5분마다 새 4장·hover 정지·컬러.
- "3~4편 영화 + 행 통째 클릭 + The catalogue 라벨 명시" → 적용.
- "3칸 + A–Z 점프바 + 정렬(기본 A–Z, 관사 무시)" → 적용, 메타테이크·감독에도 확장.
- "via [피겨] 증거 + 이미지는 오른쪽" → 카드에 via + 이미지 우측 정렬.
- "Latest는 reading만이 아니라 각 영역의 피처를 색박스로" → 엔티티 5종 색박스 masonry.
- "구획 색이 달라야 구조가 보인다" → 엔티티 색 밴드(§8).
- "Trending은 4영역 랭킹 + 더보기, 순위 안은 글이 아니라 영화·via 피겨" → 적용.
- "테이크에는 본문 2줄 노출(나머지 정보 유지)" → Takes 카드에 스니펫 2줄 클램프.
- **"메인을 다시 기획 — 너무 절제됨. 아하 모멘트·정확한 개념·계속 클릭·선한 인상"** → 홈 v6 "The Pair"로 전면 재설계(§6-01).
- **"피처 10개로 늘려 끊임없이 많다 강조 + 피처 박스형 구획 + 첫 줄에 AI 임베딩 기반(≠ 생성 콘텐츠)"** → 10-페어 갤러리 · 박스형 전시 · `.basis` 첫 줄 선언.
- **"최상단에 Blog 카테고리를 만들 것 — 거의 매일 글, 핵심은 이메일 구독, 깔끔하게, 최신 디자인과 일관"** → 블로그 디자인 세트 3종(§6B, `blog-design/`). "추가되어야 할 카테고리"로 미리 제작.

---

*이 문서: `/Users/jerryje/Documents/MetaTake/HANDOFF-MASTER-redesign-시안-총정리.md` · 6개 본체 시안(홈 v6 "The Pair") + ➕ Blog 추가 카테고리 3종 · 다른 AI 반영용.*
