# Metatake — 홈페이지 리디자인 인수인계 문서 (Handoff Spec)

> 이 문서 + `metatake-home-mockup-v7.html` 두 개만 보고 그대로 구현할 수 있도록 작성했습니다.
> 모든 색·크기·구조·데이터 소스·연결(라우트)·메커니즘·의도를 빠짐없이 기술합니다.
> 작성: 2026-06-26 · 대상 프로젝트: **metatake.net** (Supabase `kyniq` / 배포 Vercel)

---

## 0. 한눈에 보기 (TL;DR)

- **무엇:** IMDb의 정보구조(IA)와 카드 문법을 가져오되, metatake 고유의 **에디토리얼(세리프 + 크림슨)** 아이덴티티는 유지한 새 홈. 현재 홈은 `/about`로 이동.
- **핵심 원칙 1 — 영화에서 시작:** 모든 카드는 결국 한 편의 영화/감독/트로프로 클릭 진입한다.
- **핵심 원칙 2 — 현실의 수치만 쓴다:** 유저가 거의 없으므로(좋아요·조회수 미미) **하트·"이번 주 조회수"·트렌딩은 쓰지 않는다.** 대신 metatake가 실제로 많이 가진 값 — *한 reading을 공유하는 영화 수*, *Strong Misreadings/figures/tropes 카운트*, *IMDb/Metascore/RT 평점*, *캐논 리스트 수*, *임베딩 추천* — 으로 사회적 증거(social proof)를 대체한다.
- **결과물(최종):** `metatake-home-mockup-v7.html` (단일 파일, 의존성: Google Fonts만). 나머지 v1~v6은 의사결정 히스토리.

---

## 1. 파일 인덱스 (File Links)

작업 폴더: `/Users/jerryje/Documents/MetaTake/`

| 파일 | 역할 | 상태 |
|---|---|---|
| **`metatake-home-mockup-v7.html`** | **최종 목업.** 이 문서의 기준. 그대로 구현 대상. | ✅ 최종 |
| `metatake-home-handoff.md` | 이 문서 (인수인계 스펙) | ✅ |
| `metatake-home-mockup-v6.html` | v7 직전. 별점·카테고리 수치·30카드·노드그래프 도입 (수치는 placeholder였음) | 참고 |
| `metatake-home-mockup-v5.html` | 영상 히어로 + Born today + Top news 패턴 도입 | 참고 |
| `metatake-home-mockup-v4.html` | IMDb 6개 카드 포맷 혼합 도입 | 참고 |
| `metatake-home-mockup-v3.html` | 감독 섹션(스포트라이트) 추가 | 참고 |
| `metatake-home-mockup-v2.html` | 영화중심 IA 첫 버전 | 참고 |
| `metatake-home-mockup.html` (v1) | IMDb IA 최초 매핑 | 참고 |

> **구현은 v7만 기준으로 한다.** v1~v6은 "왜 이렇게 됐는지" 맥락이 필요할 때만 참고.

---

## 2. 의도와 설계 철학 (왜 이렇게 했나)

### 2.1 출발점
현재 metatake 홈은 "이 사이트가 무엇이고 어떻게 읽는가"를 설명하는 **선언문/매뉴얼** 페이지다(How a reading is built, The machine underneath 등). 첫 방문자 설득엔 좋지만, *매일 다시 오는 사람을 영화로 끌어들이는* 홈은 아니다. 그래서:
- 현재 홈 콘텐츠 → **`/about`** 페이지로 이동.
- 새 홈 → IMDb처럼 **영화/이미지가 위에서 분위기를 잡고**, 아래로 다양한 발견 레일이 이어지며, **상단 우측에 개인화 코너**가 있는 구조.

### 2.2 IMDb에서 가져온 것 / metatake로 바꾼 것
| IMDb 패턴 | metatake 적용 | 이유 |
|---|---|---|
| 상단 영상 히어로(▶ + Up next 레일 + 토픽칩) | "Today's Feature" 단일 영화 + 트레일러 + Up next | 영화에서 시작, 시네마틱 무게 |
| Top picks (키 큰 카드 + Watchlist) | "Recommended by the map" (임베딩 추천 카드 + Shelf) | 유저 이력 없이도 추천 가능(임베딩) |
| Top 10 (조회수) | "The essential 10" (prestige 점수 랭킹) | 트래픽이 없으므로 콘텐츠 점수로 |
| Coming soon (와이드 트레일러 + 좋아요) | "Newly mapped" (와이드 백드롭 + readings/tropes) | 좋아요 없음 → 콘텐츠 지표 |
| Top box office (번호 리스트 + 매출) | "The widest readings" (트로프 + N films) | 매출 없음 → 영화 공유 수 |
| Popular interests (가로 타일) | "Popular concepts" (개념 타일 + N films) | 그대로 |
| Explore streaming (탭 + 포스터) | "Explore by lens" (비평 프레임워크 탭) | 그대로 |
| Born today (원형 인물) | "Auteurs to explore" (감독 원형 + 팔로우) | 생일 데이터 불완전 → 탐색용 |
| Top news (기사 + MORE 박스) | "Between Film and the World" (실제 일일 칼럼) + **노드 그래프** | MORE 박스를 라이브 지도로 |

### 2.3 "유저가 적다"는 현실을 디자인으로 해결한 방법
DB 실측(아래 §8): `profiles 4명, user_saves 0, take_votes 0, view_events 132`. 따라서:
- **삭제:** ♡ 저장수, "Watchlist 249", "이번 주 조회수", 트렌딩 ▲, 좋아요 카운트.
- **대체:** `N films share this reading`(61·57·52…), `Strong Misreadings/figures/tropes` 수, `IMDb ★ / Metascore / RT`(외부·실데이터), `on N canon lists`, `N shared readings`(임베딩).
- **개인화 코너:** 채워진 가짜 카운트 대신 **온보딩**("Save films as you wander", "Sign in · Create account").
- 이 원칙은 사용자 수가 늘면 점진적으로 사회적 지표를 다시 켤 수 있게 설계(§7 각 섹션의 "수치 교체 지점" 참고).

---

## 3. 정보구조 (페이지 섹션 순서)

위→아래, 밝은(paper)·어두운(dark) 밴드를 교차해 리듬을 준다.

1. **상단 고정 네비게이션** (dark)
2. **Today's Feature — 영상 히어로** (dark) + Up next 레일 + 토픽칩
3. **Recommended by the map** — 추천 카드 레일 (paper)
4. **The essential 10** — Top10 (#1~3 상세 + #4~10 번호) (dark)
5. **Newly mapped** — 와이드 백드롭 레일 (dark)
6. **The widest readings** — 트로프 번호 리스트 2열 (paper-2)
7. **Popular concepts** — 가로 타일 레일 (paper)
8. **Explore by lens** — 프레임워크 탭 + 포스터 레일 (dark)
9. **Directors** — 스포트라이트 + 감독 카드 레일 (paper-2)
10. **Auteurs to explore** — 원형 인물 레일 (dark)
11. **Films that rhyme** — 포스터 레일 (paper)
12. **Recommended by** — 캐논 영화 레일 + 감독 가이드 경로 (paper-2)
13. **Between Film and the World** — 블로그 기사 + **라이브 노드 그래프** (paper)
14. **Search the map** — 대형 중앙 검색 (paper-2)
15. **Six ways in** — Films/Directors/Tropes/Strong Misreadings/Concepts/Lineage 6 facet (paper)
16. **Footer** (dark)

> 밴드 클래스: `.band`(기본 paper), `.band.dark`(어두움), `.band.p2`(paper-2 + 상하 hairline). 교차 배치가 "다채로움"의 핵심이므로 순서·밴드색을 임의로 바꾸지 말 것.

---

## 4. 디자인 시스템 (토큰)

### 4.1 색 (CSS `:root` 변수 — 그대로 사용)
```
--paper:      #FCFBF7   /* 기본 배경(따뜻한 오프화이트) */
--paper-2:    #F4F1E9   /* 보조 배경/카드 바디/밴드 */
--ink:        #1A1714   /* 본문 먹색 */
--ink-soft:   #5C564E   /* 보조 텍스트 */
--ink-faint:  #8C857A   /* 라벨/힌트 */
--red:        #C8102E   /* metatake 크림슨(액센트·CTA·섹션바) */
--red-deep:   #9b0c23   /* 크림슨 hover */
--red-soft:   #E8A7AF   /* 다크 배경 위 크림슨 텍스트 */
--gold:       #E8A100   /* IMDb 별점 ★ */
--line:       #E7E2D6   /* hairline */
--line-strong:#D6CFBF   /* 진한 보더 */
--dark:       #100D0A   /* 다크 밴드/네비/푸터 배경 */
--dark-2:     #1b1712   /* 다크 카드 */
--dark-3:     #262019   /* 다크 보조 */
--dline:      rgba(255,255,255,.09)  /* 다크 위 hairline */
```
규칙: 액센트는 **오직 크림슨(--red)**. 별점만 골드(--gold). 다크 섹션의 크림슨 텍스트는 가독성 위해 `--red-soft`.

### 4.2 타이포그래피 (Google Fonts)
- **Newsreader** (`--serif`): 디스플레이/제목/영화제목. 이탤릭 강조에 사용(크림슨 이탤릭이 시그니처).
- **Spectral** (`--text-serif`): 본문 세리프(설명·리딩 인용).
- **Inter** (`--ui`): UI 크롬(네비·버튼·라벨·수치·배지). 라벨은 `letter-spacing:.12~.16em; text-transform:uppercase; 11px/600`.
- 로드: `<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..600&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600;700&display=swap">`

주요 크기: 섹션 h2 **25px/600**(세리프), 히어로 타이틀 **34px/600**, 대형검색 **40px/600**, 본문 **17px**, 카드 제목 16px, UI 라벨 11px, 마이크로 10px.

### 4.3 레이아웃·반경·간격
- 컨테이너 `.wrap`: `max-width:1280px; padding:0 26px`.
- 섹션: `.band{padding:38px 0}`.
- 카드 반경: 8~12px (포스터 8~10, 카드/박스 11~16). 원형 인물 `border-radius:50%`.
- 레일 카드 간격 16px, 레일 하단 패딩 10px.
- 반응형 브레이크포인트: **1020px**(히어로/그리드 1열화), **680px**(네비 검색 숨김, 타이틀 축소).

### 4.4 섹션 헤더 패턴 (`.shead`)
모든 섹션 공통: 왼쪽 제목 + chevron `›` + 한 줄 sub, 오른쪽 `seeall` 링크.
- 제목 `h2`는 **왼쪽에 4px 크림슨 세로 바**(`::before`)가 붙는다 — IMDb의 노란 바를 크림슨으로. (`padding-left:15px`)
- 다크 밴드에선 제목 흰색, sub `#9c9486`, seeall `--red-soft`.

### 4.5 아이콘/글리프
별도 아이콘 폰트 없이 유니코드/인라인 SVG 사용: 로고 박스(빨간 사각형 + 흰 "Meta/take"), ▶(재생), ＋(추가), ★(별점), ♡(팔로우), ▦/❝/⌖/✦(계정 메뉴), ‹ ›(레일 화살표), ↻(reshuffle), 노드 그래프는 인라인 `<svg>`.

---

## 5. 글로벌 컴포넌트

### 5.1 상단 네비게이션 (IMDb 구조, 다크 바)
- 높이 60px, `position:sticky; top:0; z-index:90`, 배경 `--dark`.
- 좌→우: **로고(빨간 박스 Meta/take)** → **≡ Menu**(메가드롭다운 토글) → **중앙 검색**(`All ▾` 스코프 + input + ⌕) → 우측 클러스터.
- 우측 클러스터(IMDb의 IMDbPro·Watchlist·SignIn·Lang 대응): **Ask metatake AI**(크림슨 점) · **지도 아이콘**(Wander) · **Shelf**(북마크, 카운트 배지 없음 — 유저 적어서) · **계정 아바타(＋)** · **EN ▾**.
- **메가 메뉴**(`#mega`): 4열 — Browse the map / Ways through / Fresh / You. 항목에 실제 카운트(Films 1,935 · Directors 870 · Tropes 4,710 · Concepts 1,227).
- **계정 드롭다운**(`#am`) = **온보딩 패널**(유저 거의 없음 반영): 헤더 "Start your map / Sign in · Create account", 행 4개(Your Shelf / Saved Readings / Follow directors & figures / Recommended) 각 우측에 `+`/`›`, 푸터(About · Newsletter · Sign in). **채워진 숫자 카운트는 쓰지 않는다.**
- 토글 로직: `tog(id)` — 열려있으면 닫고, 아니면 다른 `.open` 닫고 연다. 바깥 클릭 시 닫힘.

### 5.2 레일/캐러셀 메커니즘 (`.railwrap > .rail`)
- `.rail{display:flex; gap:16px; overflow-x:auto; scroll-behavior:smooth}`.
- 좌우 `.scrollbtn`(42px 원형) — `data-t="레일id" data-d="-1|1"`. 클릭 시 `rail.scrollBy({left: d*520, behavior:'smooth'})`.
- 각 레일은 **최소 30장** 카드 보유(요청 사항). 레일 하단에 `.railcount`("N titles — scroll ›").

### 5.3 필름 카드 (밝은 섹션, `.tp`) — 핵심 카드
폭 **196px**. 구성(위→아래):
1. 포스터 `.pos`(aspect **2/3**, 반경 10px) — 좌상단 `＋` 원형(빠른 저장), 하단 그라데이션 위 제목 오버레이.
2. `.rateline`: **★ IMDb 평점(골드)** · 구분점 · **카테고리별 수치**(예: `◉ N shared readings`) · 우측 `☆`(저장 토글).
3. 제목 + 연도·감독.
4. **`＋ Shelf` 버튼**(풀폭 pill) — IMDb "+ Watchlist" 대응(내 목록 추가).
5. `.row2`: `❝ Top reading` 링크 + `(i)` 정보.
> 카테고리별 수치는 행마다 다르다(§7). 별점·Shelf 버튼은 모든 필름 카드 공통.

### 5.4 필름 카드 (다크 섹션, `.lcard`) — Explore by lens용
폭 162px. 포스터(2/3) + `＋` 리본 → `★ 평점 · N readings` → 제목·연도 → `via [figure]`(이탤릭) → `＋ Shelf`(다크용 보더 버튼).

### 5.5 푸터 (다크, metatake 실제 구조)
빨간 박스 로고 + 태그라인 + 5열: 브랜드설명 / **Sections**(Films·Directors·Tropes·Concepts·Lineage) / **Your map** / **Metatake**(About·Contact·Community guidelines·Blog) / **Legal**(Terms·Privacy·메일). 하단 바: © 2026 Metatake · Seoul, Republic of Korea · **"This product uses the TMDB API but is not endorsed or certified by TMDB."**(TMDB 고지 필수).

---

## 6. 디자인 시스템 — 크기 빠른 참조표

| 요소 | 크기/비율 |
|---|---|
| 컨테이너 | max 1280px, 좌우 26px |
| 네비 높이 | 60px |
| 네비 검색 max-width | 640px, 높이 38px |
| 히어로 그리드 | `1.72fr / 1fr`, gap 22px, 메인 min-height **452px** |
| 히어로 Up next 썸네일 | 116px, 16:10 |
| 필름카드(.tp) | 폭 196px, 포스터 2/3 |
| Top3 상세 포스터 | 96px, 2/3 |
| Top10 번호 카드 | 148px, 2/3 |
| 와이드 카드(.wide) | 폭 372px, 백드롭 **16:9** |
| 개념 타일(.tile) | 폭 304px, **16:9** |
| 렌즈 카드(.lcard) | 폭 162px, 2/3 |
| 감독 카드(.dcard) | 폭 158px, 인물 **3:4** |
| 감독 스포트라이트 | `286px / 1fr`, 인물 min-height 380px |
| Auteurs 원형 | 150px 원 |
| 레일 화살표 | 42px 원형, gap 16px |
| 노드 그래프 박스 | 높이 380px, viewBox 360×380 |

---

## 7. 섹션별 상세 스펙 (의도 · 데이터 · 라우트 · 메커니즘)

> 각 섹션: **의도** → **데이터 소스(Supabase)** → **표시 수치(+왜)** → **클릭 라우트** → **메커니즘/카피**.

### 7.1 Today's Feature (영상 히어로)
- **의도:** "결국 영화로 귀결" — 첫 화면에서 한 편의 영화를 시네마틱하게. IMDb 영상 히어로처럼 클릭=재생.
- **데이터:** `films`(title, year, director, backdrop_path, tagline, runtime, certification) + `film_ratings`(imdb_rating) + 그 영화의 대표 `takes`(reading 1개, `figures.label`로 "via …"). 편집 큐레이션(에디터가 today's feature 지정) 또는 `film_scores.total_score` 상위에서 회전.
- **표시:** `★ IMDb` · "Watch the trailer 2:18" · dir. · **대표 reading 1줄** · 칩(figures/readings/tropes 수). **하트/저장수 없음.**
- **이미지:** 백드롭 = `https://image.tmdb.org/t/p/w1280{backdrop_path}` (목업은 톤 placeholder).
- **트레일러:** TMDB videos(YouTube key) 임베드. `figures.youtube_query`도 있음.
- **라우트:** ▶/제목 → `/film/{slug}`. Up next 항목 → 해당 `/film/{slug}`.
- **메커니즘:** 5편 회전, `setInterval 8000ms`, `mouseenter` 시 정지. ‹ › / 썸네일 클릭으로 전환. Up next = 현재 다음 3편.

### 7.2 Recommended by the map (추천 레일)
- **의도:** 유저 이력이 없어도 **임베딩 최근접**으로 추천 — metatake의 강점. "by shared readings, no crowd needed".
- **데이터:** `film_next`(source_film_id → target/rec) 또는 `meta_take_edges`(a,b,similarity) 기반 최근접 영화. 카드 수치 = 공유 readings 수.
- **표시:** `★ IMDb · N shared readings · ＋ Shelf`.
- **라우트:** `/film/{slug}`. seeall → 추천 설명 페이지.
- **카드:** §5.3 `.tp`. 30+장.

### 7.3 The essential 10 (Top 10)
- **의도:** "Top 10"이되 **조회수가 아니라 prestige 점수**로 — 트래픽이 없는 현실 정직 반영.
- **데이터:** `film_scores`(total_score DESC) JOIN `films` JOIN `film_ratings`. (실측 1위 Nomadland 100.7, American Beauty 97.0 …)
- **표시:** #1~3 상세 카드(포스터 + `★ IMDb · Metascore · RT%` + 한 줄 Strong Misreading "syn" + ◉ Mark as read), #4~10 번호 포스터(★ + "on the canon").
- **라우트:** 각 `/film/{slug}`. seeall → 점수 설명.
- **카피 주의:** "Most opened this week" 같은 문구 금지. "Ranked by metatake's prestige + discovery score — not by traffic".

### 7.4 Newly mapped (와이드)
- **의도:** 최근 분석된 영화/리딩(콘텐츠 최신성, 트래픽 아님).
- **데이터:** `films`(또는 `takes`) `created_at` DESC. 트로프 라벨 = `meta_takes.title`/`laconic`.
- **표시(와이드 16:9):** 상단 트로프 + ▸ READ·[FRAMEWORK] + 하단 "JUST ADDED · 연도" + 제목 + `★ IMDb · N readings · N tropes`. **♡ 저장수 제거됨.**
- **라우트:** `/film/{slug}`.

### 7.5 The widest readings (트로프 번호 리스트)
- **의도:** IMDb 박스오피스 리스트 문법. 매출 대신 **"한 reading을 공유하는 영화 수"**(현실의 핵심 지표).
- **데이터:** `meta_takes`(title, slug, `film_count`) ORDER BY film_count DESC. 보조 텍스트 = 대표 영화쌍(home_cache `pairs`의 A ⟷ B). 실측: The Face 61, Duty 57, Compulsion 52, Object 43, Banality 37, Held Shot 37 …
- **표시:** 2열, `번호 · ＋ · 트로프(이탤릭 강조) · 영화쌍 · "N films"`(우측, 중립색). **트렌딩 ▲ 제거됨.**
- **라우트:** 트로프 상세 → **`meta_takes.slug`** 사용. ⚠️ 경로 미확정(아래 §9.3): `/tropes`(목록)는 있으나 `/tropes/{slug}`는 404. 실제 트로프 상세 라우트를 코드에서 확인해 연결할 것.

### 7.6 Popular concepts (타일)
- **의도:** IMDb "Popular interests" 가로 타일. 개념(이론)으로 진입.
- **데이터:** `sm_concepts`(slug, name, `n`=영화 수) ORDER BY n DESC. 실측: repetition compulsion 129, death drive 113, society of the spectacle 87, bad faith 83, banality of evil 80, the Real 64 …
- **표시(16:9 타일):** ＋ + 라벨 + "N films".
- **라우트:** `/concept/{slug}`.

### 7.7 Explore by lens (탭 + 포스터)
- **의도:** IMDb "Explore what's streaming"(탭) 문법. metatake의 **14개 비평 프레임워크**로 영화 정렬.
- **데이터:** `takes.framework`(= Subtext, Ontology, Semiotics, Enigma, Production, Location, Context, Reception, Psychoanalysis, Ethics, Politics, Counterpart, Parallel, Title)별 대표 영화 + 해당 figure.
- **표시(다크 `.lcard`):** ★ IMDb · N readings · `via [figure]` · ＋ Shelf.
- **라우트:** `/film/{slug}` (해당 프레임워크 리딩으로 딥링크 가능).
- **메커니즘:** 탭 `setLens(k)` 클릭 시 해당 레일 재렌더. 탭당 30+장.

### 7.8 Directors (스포트라이트 + 카드)
- **의도:** 감독은 중요한 데스티네이션. 한 명을 풍부히(스포트라이트) + 다수를 가로로.
- **데이터:** 스포트라이트 = `director_facts`(intro, facts) + `director_picks`(가이드 경로) + 집계(films/readings/tropes). 카드 = home_cache `doors.director`(실측: Spielberg 25, Hitchcock 22, Scorsese 20, Kurosawa 15, Joel Coen 14, Linklater 13).
- **표시:** 스포트라이트(인물 + 출생 + FILMS/READINGS/TROPES + 시그니처 트로프 3 + 필모그래피 + "Open the director →"). 카드(인물 3:4 + 이름 + "국적 · N films on the map" + 시그니처 한 줄).
- **라우트:** `/director/{director_slug}`.
- **메커니즘:** "↻ Another auteur"로 스포트라이트 회전.
- **실데이터 연결:** `/director/{slug}` 페이지는 이미 **Where to Start**(가이드 경로), **The Life**(21 facts), **Who's Next**(5 감독)를 제공 → 홈 카드에서 그대로 연결.

### 7.9 Auteurs to explore (원형 인물)
- **의도:** IMDb "Born today"의 원형-인물 비주얼을 차용하되, **생일 데이터가 불완전**하므로 "탐색/팔로우"용으로 재정의.
- **데이터:** 감독 + `director_portrait`(이미지) + 집계(N films). ♡ = 팔로우 액션(카운트 아님).
- **표시:** 150px 원형 + 이름 + "N films" + ♡(Follow).
- **라우트:** `/director/{director_slug}`.
- **수치 교체 지점:** 추후 유저 늘면 "팔로워 N" 노출 가능.

### 7.10 Films that rhyme (포스터 레일)
- **의도:** metatake 시그니처 — "장르가 아니라 공유 리딩으로 잇는다". seed 영화 기준 이웃.
- **데이터:** `film_next` / `meta_take_edges` 최근접 + 공유 readings 수.
- **표시:** 포스터 + 리본 + `N shared readings` + 연도·감독.
- **라우트:** `/film/{slug}`.

### 7.11 Recommended by (캐논 + 감독 경로) ★요청 반영
- **의도:** 사용자가 언급한 "recommended by 코너". 클릭수가 아니라 **권위 있는 출처가 보증**하는 영화.
- **데이터 — 캐논 레일:** `film_lineage`(film_id → list_id, rank) + `lineage_lists`(label, source, authority_weight). "On N canon lists" 집계. 실측 출처: Sight & Sound Critics'/Directors' Poll, Palme d'Or, Best Picture, Golden Lion/Bear, TSPDT 1,000 Greatest 등 **399개 리스트**. 영화별 리스트 수: Parasite 20, Schindler's List 19, The Hurt Locker 19, Brokeback Mountain 19, No Country 18 …
- **데이터 — 감독 가이드:** `director_picks`(director_slug, pos, film_title, film_year, **label**, reason). label = "Start here / If you loved that / The peak / The deep cut / The meta turn / The wild card / Where it ends". (예: Kiarostami 경로 — 실데이터.)
- **표시:** 캐논 카드(`★ IMDb · N canon lists · ＋ Shelf`) + "A way into [감독]" 라벨 카드들(라벨 + 제목·연도 + 이유).
- **라우트:** 캐논 카드 → `/film/{slug}`. 가이드 → `/film/{slug}` 또는 `/director/{slug}#where-to-start`. seeall → `/lineage` (399 lists).
- **참고:** `/film/{slug}` 페이지의 **"Recommended by N"**는 *이 영화를 자신의 9편 "Watch next"에 넣은 영화 수*(역추천)다. 홈의 "Recommended by"와 의미가 겹치니 카피로 구분("by the canon" vs "by other films").

### 7.12 Between Film and the World (블로그 + 노드 그래프)
- **의도:** IMDb "Top news"의 기사 레이아웃 + 우측 박스를 **라이브 지도**로. 블로그는 실제 일일 칼럼.
- **데이터 — 기사:** `posts`(title, dek, edition_date, read_min, intro). 실제 칼럼명 "Between Film and the World — the day's events, and the films that already knew". (리드 1 + 보조 4)
- **데이터 — 노드 그래프:** `meta_take_edges`(a,b,similarity) + `films`/`meta_takes` 라벨. 영화=크림슨 채움 노드, 트로프=빈 노드.
- **메커니즘:** SVG 9노드를 3×3 격자+jitter로 배치, 인접/랜덤 엣지, **3.6초마다 재무작위화**(`setInterval 3600ms`, fade-in). 각 노드는 클릭 가능 `<a>` → 실제 구현 시 `/film/{slug}` 또는 트로프 라우트. (목업은 `#`.)
- **라우트:** 기사 → `/blog/{slug}`(또는 `/{edition_date}`), 노드 → 해당 엔티티.

### 7.13 Search the map (대형 중앙 검색)
- **의도:** metatake 시그니처 검색을 페이지 중하단에 배치(요청). "or ask it anything"(AI).
- **데이터:** 전체 검색(films/directors/tropes/concepts) + AI(임베딩 질의). 칩 = 예시 쿼리.
- **표시:** 큰 입력 + "Ask AI" + 예시 칩 + facet 점프(1,935 Films · 870 Directors · 4,710 Tropes · 26,975 Strong Misreadings).
- **라우트:** 검색결과 `/search?q=` , AI는 `/ask` 또는 챗.

### 7.14 Six ways in (6 facet)
- **의도:** "Four ways in"을 6개로 확장(요청): **+ Strong Misreadings, + Lineage**.
- **표시(3×2):** Films(1,935) · Directors(870) · Tropes(4,710) · **Strong Misreadings(26,975)** · Concepts(1,227) · **Lineage(399 canon lists)**.
- **라우트:** `/film`, `/director`, `/tropes`, `/strong-misreadings`(또는 `/takes`), `/concept`, `/lineage`.

---

## 8. 데이터 레이어 (Supabase)

### 8.1 프로젝트
- **프로젝트명:** `kyniq` · **ref:** `jvgarcqrtsmgfimdcwgo` · region ap-northeast-1 · Postgres 17.
- URL: `https://jvgarcqrtsmgfimdcwgo.supabase.co` (anon/publishable key는 Supabase 대시보드 → Project Settings → API에서 복사. 문서에 키 미포함.)
- 다른 프로젝트(AVAULT, myai 등)는 metatake와 무관.

### 8.2 핵심 테이블 (홈에서 쓰는 것 중심, 실제 컬럼)
```
films            id(uuid), tmdb_id, title, original_title, year, director, director_slug,
                 poster_path, backdrop_path, overview, slug, genres, keywords, imdb_id,
                 tagline, runtime, release_date, certification, visible, is_analyzed, …
film_ratings     film_id, imdb_rating(numeric), imdb_votes(int), metascore(int),
                 rt_tomatometer(int), source, fetched_at        ← ★ 별점은 여기(외부 실데이터)
film_scores      film_id, track, prestige_score, discovery_score, total_score, components…  ← Top10 랭킹
film_next        source_film_id, position, rec_title, rec_year, rec_director, reason,
                 target_film_id, tmdb_id, poster_path           ← "Watch next" / rhyme / 추천
film_lineage     film_id, list_id, edition_id, facet, result, rank, confidence, source     ← 캐논 소속
lineage_lists    id, slug, label, source, country, tier, authority_weight, film_count, …    ← "Recommended by" 출처(399)
lineage_editions id, list_id, year, edition_label, slug, rank_max
meta_takes       id, slug, title, laconic, thesis, essay, theorist_id, status,
                 view_count, kind, film_count, member_count, cohesion …   ← 트로프(=figure-types)
takes            id, figure_id, meta_take_id, rationale, framework, leap, strength,
                 upvotes, theorist_name, concept, take_title, status …    ← Strong Misreadings(=readings)
figures          id, film_id, kind, label, description, slug, status …    ← 영화의 figure
meta_take_edges  a(uuid), b(uuid), relation, similarity                   ← 지도 엣지(노드그래프/rhyme)
sm_concepts      id, slug, name, name_l, n                                ← 개념 + 영화 수
director_facts   director_slug, name_meaning, intro, facts(jsonb)         ← 감독 Portrait/The Life
director_picks   director_slug, pos, film_id, film_title, film_year, label, reason  ← Where to Start/가이드
posts            id, slug, title, edition_date, dek, read_min, intro, entries(jsonb), status  ← 블로그
home_cache       id, payload(jsonb), updated_at                           ← ★ 홈 사전계산 페이로드
profiles         id, username, display_name, avatar_url, reputation, role …  ← 유저(현재 4명)
user_movies      user_id, film_id, rating, seen, watchlist, note …        ← 개인 Shelf/Watchlist
user_saves       user_id, entity_type, entity_ref, kind                   ← 저장(readings 등)
user_pins        user_id, entity_type, entity_id, kind                    ← 핀/팔로우
take_votes       take_id, user_id                                          ← 좋아요(현재 0)
view_events      …                                                         ← 조회(현재 132, 매우 적음)
```

### 8.3 `home_cache` — 권장 구현 방식 (가장 중요)
홈은 **테이블을 직접 여러 번 쿼리하지 말고**, `home_cache.payload`(jsonb 1행)를 읽어 렌더한다. 라이브가 이미 이 패턴을 쓴다. payload 구조(실측):
```jsonc
{
  "stats":  { "films":1935, "metas":4710, "takes":26975, "tropes":4710, "figures":18168 },
  "doors": {
    "meta":     [{ "t":"The Face As Infinite Ethical Summons", "n":61 }, …],      // 트로프+영화수
    "trope":    [{ "t":"The Cut That Obeys The Beat", "lac":"Editing surrenders…" }, …], // 신규 트로프+gloss
    "concept":  [{ "t":"repetition compulsion (Wiederholungszwang)", "n":129 }, …],
    "director": [{ "name":"Steven Spielberg", "n":25 }, …]
  },
  "pairs": [   // "ONE READING, TWO FILMS" — 히어로/widest readings/노드 소스
    { "mt":"…trope…", "slug":"…", "lac":"…한줄…", "n":61,
      "a":{ "f":"Au Hasard Balthazar","y":1966,"d":"Robert Bresson","fs":"au-hasard-balthazar-1966",
            "bd":"/7LPz…jpg","fig":"Balthazar the donkey","figslug":"balthazar-the-donkey" },
      "b":{ … } }, …
  ],
  "ticker": [ { "kind":"Trope","x":"…title…","s":"…gloss…" }, … ]
}
```
- `bd` = TMDB backdrop_path → `https://image.tmdb.org/t/p/w1280{bd}`.
- `fs` = 영화 slug → `/film/{fs}`. `figslug` = figure slug. `slug` = 트로프 slug.
- **갱신:** `updated_at`로 매일 1회 재계산(크론/엣지펑션). 홈은 ISR(아래)로 캐시.

### 8.4 섹션별 예시 SQL (사전계산 시 사용)
```sql
-- Top 10 (essential): 점수 랭킹 + 별점
select f.title,f.year,f.director,f.slug,fr.imdb_rating,fr.metascore,fr.rt_tomatometer,fs.total_score
from films f join film_scores fs on fs.film_id=f.id
left join film_ratings fr on fr.film_id=f.id
where f.visible order by fs.total_score desc nulls last limit 10;

-- Recommended by the canon: 영화별 캐논 리스트 수
select f.title,f.year,f.slug,count(*) lists
from film_lineage fl join films f on f.id=fl.film_id
group by f.id,f.title,f.year,f.slug order by lists desc limit 30;

-- The widest readings: 트로프별 영화 수
select title,slug,film_count from meta_takes
where status='published' order by film_count desc limit 30;

-- Popular concepts
select name,slug,n from sm_concepts order by n desc limit 30;

-- 감독 가이드 경로(Where to start)
select pos,film_title,film_year,label,reason from director_picks
where director_slug=$1 order by pos;
```

### 8.5 "진짜 vs placeholder" (정직성 표)
| 항목 | 상태 |
|---|---|
| films/tropes/readings/figures 총계, N films per reading, 개념 수, 감독 film 수 | **실데이터(home_cache)** |
| IMDb 평점·Metascore·RT | **실데이터(film_ratings, OMDb)** |
| 캐논 리스트·소속(Sight&Sound 등) | **실데이터(lineage_lists/film_lineage)** |
| 감독 가이드 경로/이유 | **실데이터(director_picks)** |
| 블로그 칼럼명·deck | **실데이터(posts)** |
| 목업의 카드 톤(그라데이션) | placeholder → **TMDB poster/backdrop로 교체** |
| 일부 감독 "시그니처 트로프" 문구(카드용) | placeholder → meta_takes 집계로 교체 권장 |
| ♡ 저장수·조회수·트렌딩 | **사용 안 함(데이터 없음)** |

### 8.6 RLS / 보안
- 콘텐츠 테이블은 RLS on. 홈은 **공개 읽기**만 필요 → `home_cache`/공개 뷰에 anon SELECT 정책 부여 권장. 개인화(Shelf/Following)는 `auth.uid()` 기반 정책.
- 서버 렌더 시 service role 키는 **서버에서만**. 클라이언트는 anon 키 + RLS.

---

## 9. 라우팅 & 연결 (Vercel / Next.js 기준)

### 9.1 아키텍처(권장)
- **Next.js(App Router) + Vercel.** 홈 `/`는 **ISR**(예: `export const revalidate = 3600`)로 `home_cache`를 읽어 정적 생성, 매시간/매일 갱신. 노드 그래프·히어로 회전·탭은 클라이언트 컴포넌트.
- Supabase 클라이언트: `@supabase/supabase-js`(서버), 환경변수:
  - `NEXT_PUBLIC_SUPABASE_URL = https://jvgarcqrtsmgfimdcwgo.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY = (대시보드에서 복사)`
  - (서버 전용) `SUPABASE_SERVICE_ROLE_KEY` — 사전계산/크론용.
- 이미지: `next/image` + `images.remotePatterns`에 `image.tmdb.org` 허용. 포스터 `t/p/w500`, 백드롭 `t/p/w1280`, 인물 `t/p/w342`.

### 9.2 라우트 맵 (확인됨 ✅ / 미확인 ⚠️)
| 경로 | 내용 | 상태 |
|---|---|---|
| `/` | 새 홈 (이 목업) | 신규 |
| `/about` | 기존 홈 콘텐츠 이전 | 기존(`/about` 존재) ✅ |
| `/film` | 영화 카탈로그(A-Z/Genre/Year, 필터, 상단 random deck) | ✅ |
| `/film/{slug}` | 영화 상세 | ✅ (예: `/film/au-hasard-balthazar-1966`) |
| `/director` | 감독 카탈로그(870) | ✅ |
| `/director/{director_slug}` | 감독 상세(Portrait·Filmography·Where to Start·The Life·Who's Next) | ✅ (예: `/director/stanley-kubrick`) |
| `/tropes` | 트로프 목록 | ✅ |
| `/tropes/{slug}` | 트로프 상세 | ⚠️ **404** — 실제 상세 경로 코드에서 확인(후보: `/trope/{slug}`) |
| `/concept` | 개념 목록 | ✅ |
| `/concept/{slug}` | 개념 상세 | 추정(코드 확인) |
| `/lineage` | 캐논/계보 | 나브에 존재 ✅ |
| `/archetype`, `/theory`, `/blog`, `/trending`, `/latest`, `/strong-misreadings` | 나브 항목 | 코드 확인 |
| `/contact` `/guidelines` `/terms` `/privacy` | 푸터 | ✅ |

### 9.3 트로프 상세 경로 (해결 필요)
`/tropes/{slug}`가 404이므로(목록만 plural), **개별 트로프 라우트를 실제 코드/라우터에서 확인**해 §7.5·노드그래프·widest readings의 링크를 연결할 것. `meta_takes.slug`가 키. 라이브 카드의 "Open this trope →" href를 inspect하면 즉시 확정 가능.

### 9.4 영화 상세 페이지가 홈과 맞물리는 지점(참고)
`/film/{slug}`는 이미 다음을 제공 → 홈 카드 클릭의 "도착지"가 풍부함:
- 헤더 카운트: **FIGURES · STRONG MISREADINGS · TROPES · CONNECTED FILMS** (홈 카드 수치 라벨과 일치시킬 것)
- **IMDb ★ / 득표 / RT% / METASCORE**, 국가, STREAM(JustWatch via TMDB)
- Invitation, Why watch, **Lineage(CANONS & LISTS)**, **Recommended by N**(=이 영화를 Watch next에 넣은 N편), 14개 프레임워크 Strong Misreadings, Figures, Tropes, Archetype, Reception, **Watch next(9 curated)**, Films like(임베딩 최근접), Connection map.

---

## 10. 메커니즘 정리 (인터랙션 상세)

| 메커니즘 | 동작 |
|---|---|
| 히어로 회전 | `setInterval(8000ms)`, `mouseenter` 시 `clearInterval`. ‹ › / 썸네일 클릭 즉시 전환. Up next=다음 3편. |
| 레일 스크롤 | `.scrollbtn` 클릭 → `scrollBy({left:±520, smooth})`. 터치/휠 가로 스크롤. |
| 렌즈 탭 | `setLens(key)` → 활성 탭 표시 + 해당 레일 재렌더. |
| 감독 스포트라이트 | "↻ Another auteur" → `dstep(1)`로 회전. |
| 계정/메뉴 드롭다운 | `tog(id)` 토글, 바깥 클릭 닫힘. |
| 노드 그래프 | 9노드 3×3 격자+jitter, 인접+랜덤 엣지, `setInterval(3600ms)` 재무작위 + `.gfade` 애니메이션. 노드 `<a>` 클릭=진입. |
| Shelf/저장/팔로우 | 인증 필요. 비로그인 시 로그인 유도. |

---

## 11. 구현 체크리스트

- [ ] Next.js(App Router) + Vercel 프로젝트, env 3종 설정, `image.tmdb.org` 허용.
- [ ] `/` 홈: `home_cache.payload` 읽어 ISR 렌더. 섹션 16개 순서·밴드색 그대로.
- [ ] 디자인 토큰(§4) CSS 변수로 이식, 폰트 3종 로드.
- [ ] 글로벌 컴포넌트(네비·메가·온보딩 드롭다운·레일·푸터) 구현.
- [ ] 필름카드(밝음/다크) 2종 + 와이드/타일/번호리스트/원형/감독 카드.
- [ ] 별점=film_ratings, Top10=film_scores, 캐논=film_lineage, 가이드=director_picks, 개념=sm_concepts, 트로프=meta_takes(film_count) 바인딩.
- [ ] 노드 그래프(meta_take_edges) + 클릭 라우팅.
- [ ] 카드 클릭 라우트 전부 연결(§9.2). **트로프 상세 경로 확정(§9.3).**
- [ ] TMDB 이미지(poster/backdrop/profile) 교체.
- [ ] 개인화(Shelf/Following) RLS 정책 + 비로그인 온보딩.
- [ ] TMDB 고지·푸터·법무 링크.
- [ ] 반응형(1020/680) 검수.

## 12. 미해결/후속 (Open questions)
1. **트로프 상세 라우트** 확정(§9.3).
2. 감독 카드의 "시그니처 트로프" 문구를 `meta_takes` 집계 실값으로 교체.
3. "Today's Feature" 선정 로직: 에디터 수동 vs `film_scores`/신규 자동 — 정책 결정.
4. 캐논 리스트 11~13위 영화의 정확한 list count는 SQL로 재산출(§8.4).
5. `home_cache` 재계산 스케줄(엣지펑션/크론) 확정.
6. Vercel 배포: 현재 **미배포** 상태. 위 env·ISR 설정 후 배포.

---

## 13. 부록 — CSS 클래스 글로서리(주요)
```
.wrap            컨테이너(1280/26)
.band(.dark/.p2) 섹션 밴드(기본/다크/paper-2)
.shead           섹션 헤더(크림슨 세로바 + chevron + sub + seeall)
.railwrap/.rail  캐러셀 래퍼/스크롤 영역  ·  .scrollbtn 좌우 화살표  ·  .railcount 개수표시
.vh/.vmain/.vbottom/.upnext/.unv/.topicchips  히어로
.tp              필름카드(밝음): .pos/.addcirc/.rateline/.star/.catnum/.wl(Shelf)/.row2
.lcard           필름카드(다크, 렌즈): .lrate/.lstar/.lread/.vi/.lwl
.t3grid/.t3/.tr10  Top10(#1~3 상세/#4~10 번호)
.wide            와이드 백드롭 카드(16:9)
.bo              트로프 번호 리스트(2열): .num/.tt/.delta(=N films)
.tile            개념 타일(16:9)
.tabs/.tab       렌즈 탭
.dspot/.portrait/.dbody/.sig/.filmo/.dopen  감독 스포트라이트
.dcard/.dpic     감독 카드(3:4)
.born/.bp        Auteurs 원형 인물
.news/.lead/.sub2/.na  블로그 기사  ·  .graphbox/#graph/.gnode/.gedge  노드 그래프
.apath/.apk      "A way into [감독]" 가이드 경로 카드
.bigsearch       대형 중앙 검색
.facetgrid/.facet  Six ways in
footer/.fgrid/.fbrand/.fbar/.tmdb  푸터
```

---
*문서 끝. 문의: 디자인 의도·수치 근거는 §2/§7/§8, 색·크기는 §4/§6, 데이터·라우트는 §8/§9 참조. 구현은 v7 HTML과 이 문서를 1:1로 따라가면 됩니다.*
