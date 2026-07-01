# Metatake — 트로프 상세 페이지 인수인계 문서 (Trope / Reading Detail Spec)

> 대상 목업: **`metatake-trope-detail-mockup.html`** (예시 데이터: *The Face As Infinite Ethical Summons* — 실데이터)
> 이 문서 + 목업 HTML만 보고 **하나의 "reading / trope(figure-type)" 상세 페이지**(여러 영화에 걸쳐 동일하게 읽히는 한 개의 비평 코드)를 그대로 구현할 수 있도록 작성.
> 공유하는 디자인 토큰·네비·푸터는 `metatake-film-detail-handoff.md`(§4) / `metatake-home-handoff.md`를 기준으로 하고, 여기서는 **트로프 상세 고유의 구조·데이터·메커니즘**을 다룬다.
> 작성: 2026-06-26 · 프로젝트: Supabase `kyniq`(ref `jvgarcqrtsmgfimdcwgo`) / Vercel.

---

## 0. 한눈에 보기 (TL;DR)

- **무엇:** metatake가 "트로프 / figure-type"라 부르는 **하나의 비평 코드(reading)** 의 종착 페이지. 영화 상세(`/film/{slug}`)가 "한 편을 깊게 읽기"라면, 이 페이지는 "**하나의 읽기 방식이 여러 영화에 걸쳐 동일하게 재발한다**"를 보여준다. 중심에 트로프, 둘레에 그것을 instantiate 하는 영화들.
- **본문 데이터는 전부 실제 테이블에서 온다**(§5 매핑). 백드롭/포스터만 TMDB 자리 placeholder.
- **6개 본문 섹션** + 마스트헤드 + 스티키 서브네비 + 스크롤스파이. 영화 상세와 **동일한 디자인 시스템**(토큰/네비/푸터/`.band`·`.shead` 크림슨 바/마스트헤드/`.graphbox` 라이브 노드 그래프).
- 헤로 콘셉트: 영화 상세의 **"ONE READING, TWO FILMS"** 피처를 트로프 버전으로 재사용 — *Au Hasard Balthazar* ⟷ *Chronicle of a Summer*.
- ⚠️ **라우트:** 라이브 확인 결과 **`/trope/{slug}` (단수)가 정상 동작**한다. `/tropes/{slug}` (복수)는 빈 페이지. 목록만 `/tropes`. §7 참조.

---

## 1. 파일 링크

작업 폴더 `/Users/jerryje/Documents/MetaTake/`

| 파일 | 역할 |
|---|---|
| **`metatake-trope-detail-mockup.html`** | 이 문서의 구현 기준 (트로프 상세) |
| `metatake-trope-detail-handoff.md` | 이 문서 |
| `metatake-film-detail-mockup.html` | 영화 상세 목업 — **네비·푸터·마스트헤드·서브네비·스크롤스파이·graph JS·`.rcard` 등 공유 컴포넌트의 출처** |
| `metatake-film-detail-handoff.md` | 영화 상세 인수인계 (이 문서가 깊이를 미러링) |
| `metatake-home-handoff.md` | 홈 인수인계 — 공유 디자인 토큰/네비/푸터의 단일 출처 |
| `metatake-home-mockup-v7.html` | 홈 최종 목업 (카드 시스템 참조원) |

---

## 2. 의도 (왜 이렇게)

1. **트로프는 "재발하는 읽기"다.** 한 영화의 Strong Misreading 카드가 같은 코드를 공유하면 그것이 하나의 트로프(=`meta_takes`, `kind='figure_type'`)로 모인다. 이 페이지는 그 코드 *그 자체*가 주인공 — 영화가 아니라 **읽기가 주어**다.
2. **영화 상세의 IA 문법을 차용·미러:** 큰 다크 마스트헤드 → 스티키 서브네비 → 길게 이어지는 섹션. 단 마스트헤드의 좌측 포스터 대신, 트로프는 포스터가 없으므로 **타이틀 중심 thead**(라벨 + 제목 + gloss + 성숙도 배지 + 스탯 + CTA)로 바꾼다.
3. **신뢰 = 규모 + 임베딩 + 이론.** 사용자 활동 대신 **61 films / 61 figures / 14 frameworks** 같은 구조 지표, **AI 임베딩**으로 묶었다는 정직한 고지, 그리고 **이론가(Levinas)** 로 권위를 만든다.
4. **"ONE READING, TWO FILMS"의 트로프판:** 홈/영화에서 쓰던 한 쌍 대비 피처를 그대로 가져와, 이 트로프가 가장 강하게 묶는 두 영화를 보여준다(가장 비유사한 두 영화가 같은 코드에 도달하는 충격).
5. **정직한 placeholder:** 백드롭/포스터는 TMDB 자리. 본문(films/figures/frameworks/related/concepts)은 전부 실데이터.

---

## 3. 정보구조 (섹션 순서 · 앵커 id)

마스트헤드(dark) → **스티키 서브네비**(dark) → 본문(밝음/paper-2/다크 교차).

| # | 섹션 | 앵커 id | 밴드 |
|---|---|---|---|
| — | 상단 네비 (홈/영화와 동일) | — | dark |
| — | **마스트헤드** (브레드크럼·라벨·제목·gloss·성숙도 배지·스탯·CTA) | — | dark |
| — | **스티키 서브네비** (6 앵커 + 스크롤스파이) | — | dark |
| 1 | **Thesis / essay** (이 트로프가 주장하는 것 + AI 고지) | `#thesis` | paper |
| 2 | **The pair** (ONE READING, TWO FILMS) | `#pair` | paper-2 |
| 3 | **Films that instantiate it** (영화 카드 그리드) | `#films` | paper |
| 4 | **Critical frameworks & theory** (프레임워크 칩 + 이론가 카드) | `#frameworks` | paper-2 |
| 5 | **Connection map** (라이브 노드 그래프) | `#map` | dark |
| 6 | **Related tropes & concepts** (행 리스트 + 칩) + 편집 출처 | `#related` | paper |
| — | 푸터 (홈/영화와 동일) | — | dark |

> 서브네비 앵커 6개 = 본문 섹션 6개와 1:1. 순서 변경 시 스크롤스파이 매핑(`#subnav a` ↔ `section[id]`)도 함께 유지할 것.

---

## 4. 디자인 시스템

### 4.1 공유 토큰 (영화/홈과 100% 동일)
색 변수(`--paper:#FCFBF7`, `--paper-2:#F4F1E9`, `--ink:#1A1714`, `--red:#C8102E`, `--gold:#E8A100`, `--dark:#100D0A`, `--line`, `--dline` …), 폰트(**Newsreader / Spectral / Inter**, Google Fonts only), `.band`/`.p2`/`.dark` 밴드, `.shead` + 크림슨 4px 세로바, 네비, 푸터(TMDB 고지 포함), 상단 `.mockbar` 노트, `.graphbox`/`.gnode`/`.gedge`/`.gfade` 그래프 스타일 — 영화 상세 목업의 `<style>` 블록에서 **그대로 복사**해 사용했다. 단일 컴포넌트로 공유 권장.

### 4.2 이 페이지 고유 컴포넌트 & 크기
| 요소 | 사양 |
|---|---|
| 컨테이너 | max 1280px / 좌우 26px (공통) |
| `section[id]` 점프 오프셋 | `scroll-margin-top:112px` (네비 60 + 서브네비 48 + 여유) |
| 마스트헤드 `.thead` | 포스터 없음. max-width 920px. 라벨(`.tlabel`) + 제목 + gloss + 스탯 + CTA 세로 스택 |
| `.tlabel` | "TROPE · FIGURE-TYPE" 대문자 red-soft + 성숙도 `.badge`(gold 칩) |
| 제목 `.mtitle` | 54px / 600 세리프 (≤1020:40px, ≤680:32px) |
| gloss `.tgloss` | 20px 이탤릭, max-width 760px (= `meta_takes.laconic`) |
| 스탯 스트립 `.statstrip` | 3칸(Films · Figures · Critical frameworks), 값 26px, max-width 560px |
| CTA `.mcta` | `＋ Save reading`(크림슨 primary) · `⌖ Open the map`(ghost, #map 앵커) |
| 스티키 서브네비 | `position:sticky; top:60px`, 높이 48px, 가로 스크롤, 활성=흰색+크림슨 밑줄 |
| Thesis `.thesis` | max-width 820px, 본문 18px/1.62, **드롭캡 62px 크림슨**, 하단 AI 고지 노트 |
| **The pair `.pairwrap`** | 2열 백드롭(left/right) + 중앙 메달리온(`.pairmed`, 크림슨 보더, gloss + "Open both readings →"). 백드롭은 다크 그라데이션 placeholder. ≤1020:세로 스택, 메달리온 인라인화 |
| **Films `.filmgrid`** | 5열 그리드(≤1020:3열, ≤680:2열). `.fcard`: 포스터 2/3 placeholder + 제목/연도·감독 + "via {figure}"(이탤릭) + "→ reading" |
| Frameworks `.fwchips` | 칩(프레임워크명 + 카운트 배지). `.theorist` 카드: 이니셜 아바타 + 이론가명 + 개념(이탤릭) + "Open the concept →" |
| Connection map `.graphbox` | 높이 420px, viewBox 1180×420. **중심=트로프**(크림슨 r13), 링=instantiate 영화(빈 원 + red-soft 링 r7), 외곽=related 트로프(크림슨 r5). 4.2초마다 재배치 + fade |
| Related `.tropelist` | 2열 행 리스트(≤1020:1열), 우측 film_count 배지(크림슨 pill). 아래 `.cgroup` 개념 칩(`.cchips`, 카운트 배지) |
| `.prov` | 편집 출처(이탤릭, 상단 hairline) |
| 반응형 | 1020px / 680px 두 단계 |

---

## 5. 섹션별 상세 스펙 (데이터 매핑 · 라우트 · 메커니즘)

> 표기: **소스** = Supabase 테이블.컬럼. 트로프 1건의 PK는 `meta_takes.id`(예: `a0ada98e-8650-4803-bfbf-3aeec035a081`).
> 핵심 발견: 멤버십은 **`takes.trope_id = meta_takes.id`** 로 연결된다(이 페이지의 예시 트로프는 `takes.meta_take_id`가 아니라 `takes.trope_id`로 묶임 — 둘 다 61건 확인). 유사도 랭킹은 별도 매핑 테이블 **`figure_type_members(meta_take_id, figure_id, sim)`** 에 있다.

### 5.0 마스트헤드
- **소스:** `meta_takes`(slug, title, **laconic**=gloss, thesis, essay, **maturity**, trope_kind, kind, **film_count**, **member_count**, cohesion, theorist_id, theory_family_id).
- **라벨:** "TROPE · FIGURE-TYPE" (`kind='figure_type'`). 성숙도 배지 = `maturity` 매핑(`cliche`→CLICHÉ, `established`→ESTABLISHED, `emerging`→EMERGING).
- **스탯 스트립(3):** Films = `film_count`; Figures = `member_count`; **Critical frameworks** = `count(distinct takes.framework where trope_id=:id)`.
  - ⚠️ **목업 vs 실데이터 불일치(정직 표기):** 명세 지시에 따라 목업은 **61 FILMS · 61 FIGURES · 14 frameworks** + 배지 **ESTABLISHED** 로 노출. **실 DB 값은 `film_count=61`, `member_count=61`(일치)이나, `maturity='cliche'`(→ 실제 배지는 CLICHÉ), distinct framework는 3개**(ETHICAL-PHILOSOPHICAL 53 / PHENOMENON→NOUMENON 5 / NOUMENON 3). 구현 시 **DB 실값을 따를지(권장), 14·ESTABLISHED 디자인 값을 유지할지** 편집 결정 필요. "14 critical frameworks"는 metatake 전체 프레임워크 분류 개수(영화 상세의 14 프레임워크)와 정합하지만 **이 트로프가 실제로 사용하는 프레임워크 수는 3개**다.
- **CTA:** `＋ Save reading`(saved readings), `⌖ Open the map`(#map 앵커, 동일 페이지 스크롤).
- **라우트:** 브레드크럼 "Tropes" → `/tropes`(목록, 라이브 확인됨).

### 5.1 Thesis / essay
- **의도:** 이 트로프가 *무엇을 주장하는가*를 metatake 보이스로. 라이브 페이지는 `laconic`(짧은 한 줄) + `thesis`(한 단락)를 노출하고 `essay`는 `null`이다. 목업은 thesis를 토대로 **2단락 + AI 고지**로 확장.
- **소스:** `meta_takes.thesis`(본문), `meta_takes.essay`(있으면 본문, 현재 null). gloss는 마스트헤드의 `laconic`.
- **카피 고정:** 하단에 "○ Built from AI embeddings; the reading is criticism, the AI is the instrument that finds it." — metatake의 AI 정직성 고지.

### 5.2 The pair (ONE READING, TWO FILMS)
- **의도:** 이 트로프가 **가장 강하게 묶는 두 영화** 대비. 영화/홈의 동일 피처 재사용.
- **소스:** `takes`(trope_id=:id) JOIN `figures`(film_id, label="via …", slug) JOIN `films`(title, year, director, slug). 쌍 선택 = `figure_type_members.sim` 최상위 두 멤버, 또는 두 멤버 임베딩 간 거리(상이성↑)로 "가장 멀지만 같은 코드"를 노린 큐레이션.
- **목업 값(실데이터, 라이브 확인):**
  - **Au Hasard Balthazar (1966, Robert Bresson)** · *via Balthazar the donkey* (`/film/au-hasard-balthazar-1966`, figure `balthazar-the-donkey`)
  - **Chronicle of a Summer (1961, Jean Rouch)** · *via the street interview: 'Are you happy?'* (`/film/chronicle-of-a-summer-1961`, figure `the-street-interview-are-you-happy`)
- **표시:** 좌/우 백드롭 placeholder + 중앙 메달리온(공유 gloss + "Open both readings →"). 메달리온 gloss는 트로프 `laconic`의 변주 또는 편집 카피.
- **라우트:** 각 영화 → `/film/{slug}`(또는 해당 figure 리딩 `/film/{slug}/figure/{fig_slug}`). 라이브는 figure 단위 URL을 쓴다.

### 5.3 Films that instantiate it
- **소스:** `takes`(trope_id=:id) JOIN `figures` JOIN `films`. 카드당: 포스터(TMDB `poster_path`), title, year, director, **via = `figures.label`**, → reading.
- **정렬/상한:** 라이브는 영화 제목 알파벳순 61개 전부 노출. 목업은 명세대로 **대표 10편 + "See all 61 films →"**. (대안 정렬: `takes.strength` desc → 가장 강한 인스턴스 우선.)
- **목업 10편(전부 실 DB 존재, slug 확인):** au-hasard-balthazar-1966, chronicle-of-a-summer-1961, amour-2012, the-zone-of-interest-2023, still-the-water-2014, a-man-escaped-1956, mouchette-1967, come-and-see-1985, of-gods-and-men-2010, diary-of-a-country-priest-1951.
  - ⚠️ via 라벨: Au Hasard Balthazar(Balthazar the donkey), Chronicle of a Summer(street interview)는 **실 figure 라벨**. 나머지 8편의 "via {figure}"(held hand / garden wall / slaughtered goat / prisoner's gaze / Florya's face …)는 **명세가 지정한 대표 라벨로, 실제 그 트로프 멤버십·figure 라벨은 구현 시 `takes`/`figures`로 확정 필요**(이들 영화가 이 트로프의 멤버인지 DB에서 검증할 것 — 일부는 다른 Levinas 인접 트로프 소속일 수 있음).
- **라우트:** 카드 → `/film/{slug}`(라이브는 figure 리딩 URL).

### 5.4 Critical frameworks & theory
- **소스(프레임워크):** `select distinct framework, count(*) from takes where trope_id=:id group by framework`. 실값: **Ethical–Philosophical(53) · Phenomenon→Noumenon(5) · Noumenon(3)**. 목업은 이 셋 + 분류 라벨(Ethics/Subtext/Ontology) 칩을 추가 노출.
- **소스(이론):** `meta_takes.theorist_id` → `theorists`(현재 trope row의 `theorist_id`는 **null**). 대신 멤버 `takes.theorist_name` / `takes.concept`가 일관되게 **"Emmanuel Levinas" / "the face of the Other (le visage) / infinite responsibility"** 로 채워져 있어 이를 사용. 구현 시 `theorists` 테이블에 Levinas row가 있으면 그 slug로, 없으면 `takes.theorist_name` 집계로 표시.
- **표시:** `.theorist` 카드(이니셜 아바타 EL + 이름 + 개념 이탤릭 + "Open the concept →").
- **라우트:** 이론가/개념 → `/concept/{slug}` (개념 slug는 §5.6 참조).

### 5.5 Connection map
- **의도:** "트로프 = 중심, instantiate 영화 = 링, related 트로프 = 외곽"의 라이브 지도. (영화 상세 그래프의 의미만 트로프 중심으로 치환.)
- **소스:** 중심 = 이 trope. 링 = 멤버 영화(`takes.trope_id`/`figure_type_members`). 외곽 = `meta_take_edges`(a,b,similarity) 이웃 트로프. 임베딩 기반.
- **메커니즘:** 중심 1 + 링(원형 배치) + 외곽. `setInterval(4200ms)` 재배치 + `.gfade`. 노드 `<a>` 클릭 = 진입(영화 `/film/{slug}` / 트로프 `/trope/{slug}`).
- 목업은 영화 상세의 graph JS를 **그대로 재사용**하되 라벨 배열만 교체(`FILMS`=멤버 영화, `TRO`=related 트로프, 중심 텍스트="The Face As Ethical Summons").

### 5.6 Related tropes & concepts
- **소스(related 트로프):** `meta_take_edges`에서 `a=:id OR b=:id`, 상대 노드를 `meta_takes`로 조인(title, slug, film_count), `similarity desc`. 실값 상위: The Face That Forbids The Kill(6, sim .902), The Bystander Indicted By The Face(11, .848), Care For The Ungrateful Other(11, .84), The Refusal Of The Face(4, .834) … 목업은 이들 + 명세 지정 트로프(The Held Shot As Ethical Witness, The Person Used Merely As Means, The Donkey As Mute Moral Witness)를 섞어 8행 노출.
  - ⚠️ 명세 지정 3개 중 The Held Shot As Ethical Witness / The Person Used Merely As Means는 **edge 상위 결과에 없었다**(DB에 별도 존재 여부·정확 slug 확인 필요). The Donkey As Mute Moral Witness는 영화 상세 목업에 등장(slug `the-donkey-as-mute-moral-witness`로 가정).
- **소스(concepts):** `sm_concepts`(slug, name, name_l, **n**=영화/사용 수). 실값: "the face of the Other (le visage)"(n=31), "…/ infinite responsibility"(29), "responsibility for the Other"(11), "…/ ethics as first philosophy"(7) 등. 목업은 명세대로 "the face of the Other (le visage)" 등을 칩으로.
  - ⚠️ 명세는 "(24 films)"로 적었으나 실 DB `n`은 **31**(le visage). 카운트는 DB 실값을 권장.
  - ⚠️ `sm_concepts.slug`는 인코딩된 형태(예: `theefaceeofetheeothere-leevisage`). 목업은 가독 slug(`the-face-of-the-other-le-visage`)를 placeholder로 썼으니 **실 라우팅은 `sm_concepts.slug` 사용**.
- **라우트:** related 트로프 → `/trope/{slug}`; 개념 → `/concept/{slug}`(`sm_concepts.slug`).
- **편집 출처:** "Generated by the metatake editorial method (AI-drafted) · created Jun 23, 2026 · editor Wonwoo Yoon" (= `meta_takes.created_at`, editor).

---

## 6. 데이터 레이어 — 이 페이지가 쓰는 테이블

```
meta_takes        id, slug, title, laconic(=gloss), thesis, essay,
                  maturity, trope_kind, kind, film_count, member_count,
                  cohesion, theorist_id, theory_family_id, created_at        (헤더/Thesis)
takes             figure_id, trope_id, meta_take_id, framework, leap,
                  strength, take_title, rationale, theorist_name, concept    (멤버십·프레임워크·이론·via)
figures           id, film_id, label(="via …"), slug                        (via figure)
films             id, title, year, director, slug, poster_path, backdrop_path (Pair/Films grid)
figure_type_members  meta_take_id, figure_id, sim                           (유사도 랭킹 → Pair 선택)
meta_take_edges   a, b, similarity, relation                                 (Connection map / Related 트로프)
sm_concepts       id, slug, name, name_l, n                                  (Related concepts)
theorists         (slug, name …) — theorist_id가 채워진 경우                 (이론가 카드, 현재 null)
```

### 6.1 섹션별 예시 SQL (`:id` = meta_takes.id)
```sql
-- 헤더 / Thesis
select slug,title,laconic,thesis,essay,maturity,kind,film_count,member_count,cohesion,theorist_id
from meta_takes where slug = 'the-face-as-infinite-ethical-summons';

-- 스탯: distinct framework 수
select count(distinct framework) from takes where trope_id = :id;

-- The pair (가장 강한 두 멤버; 유사도 랭킹)
select f.title,f.year,f.director,f.slug, fig.label as via, fig.slug as fig_slug, m.sim
from figure_type_members m
join figures fig on fig.id = m.figure_id
join films f on f.id = fig.film_id
where m.meta_take_id = :id
order by m.sim desc limit 2;

-- Films that instantiate it (멤버 영화 + via figure + framework)
select f.title,f.year,f.director,f.slug, fig.label as via, fig.slug as fig_slug, t.framework, t.strength
from takes t
join figures fig on fig.id = t.figure_id
join films f on f.id = fig.film_id
where t.trope_id = :id
order by f.title;            -- 또는 t.strength desc

-- Frameworks
select framework, count(*) n from takes where trope_id = :id group by framework order by n desc;

-- Theory (theorist_id null이면 takes에서 집계)
select distinct theorist_name, concept from takes where trope_id = :id and theorist_name is not null;

-- Related tropes (edge neighbours)
select mt.title, mt.slug, mt.film_count, e.similarity
from meta_take_edges e
join meta_takes mt on mt.id = (case when e.a = :id then e.b else e.a end)
where (e.a = :id or e.b = :id)
order by e.similarity desc limit 8;

-- Related concepts
select slug, name, n from sm_concepts where name ilike '%face%' or name ilike '%responsib%'
order by n desc limit 6;     -- 실제로는 trope↔concept 매핑이 있으면 그 조인을 사용
```

### 6.2 "진짜 vs placeholder"
| 항목 | 상태 |
|---|---|
| title, laconic(gloss), thesis, film_count, member_count, maturity, cohesion | **실데이터** |
| 멤버 영화/figure/framework/theorist_name/concept (`takes`+`figures`+`films`) | **실데이터** |
| 유사도 랭킹(`figure_type_members.sim`), related 트로프(`meta_take_edges`), 개념(`sm_concepts`) | **실데이터** |
| The pair 두 영화 + via 라벨 | **실데이터**(라이브 확인) |
| Films 그리드 8편의 "via {figure}" 라벨(Balthazar·Chronicle 제외) | **명세 지정 placeholder** — DB로 멤버십·라벨 확정 필요 |
| 백드롭/포스터/이론가 사진 | placeholder → **TMDB / 자산 교체** |
| 스탯 "14 frameworks" + 배지 "ESTABLISHED" | **명세 지시값** — 실 DB는 3 frameworks / maturity=cliche(§5.0) |
| related 트로프 중 The Held Shot…, The Person Used… | **확인 필요**(edge 상위 미검출) |
| 개념 카운트 "(24)" → 실값 31 | **DB 실값 권장** |

---

## 7. 라우팅 & 연결 (Vercel/Next.js) — ⚠️ 라우트 확정 포함

- **경로(✅ 라이브 확인):** **`/trope/[slug]` (단수)** 가 정상 동작한다. 2026-06-26 fetch 결과 `https://metatake.net/trope/the-face-as-infinite-ethical-summons` = 전체 콘텐츠 렌더(제목·gloss·61 readings·related·map). 반면 `https://metatake.net/tropes/the-face-as-infinite-ethical-summons` (복수) = **빈 페이지**. 목록은 `/tropes`.
  - 즉 홈/영화 문서의 "트로프 상세 라우트 미확정" 경고는 **`/trope/{slug}`로 해소**된다. 키 = `meta_takes.slug`. 없으면 404.
  - 네비/푸터의 "Tropes" 링크 = `/tropes`(목록).
- **렌더:** SSG + ISR 권장(`generateStaticParams`로 `status='published'` 트로프 prebuild, `revalidate`). 페이지 데이터는 §6.1 쿼리를 서버에서 1회 묶어 fetch(또는 트로프 캐시 뷰/RPC).
- **이미지:** `next/image`, `image.tmdb.org` 허용. 백드롭 w1280 / 포스터 w500. 트로프 자체는 포스터가 없으므로 마스트헤드는 텍스트, Pair/Films의 백드롭·포스터만 멤버 영화 자산.
- **내부 링크:** 영화 `/film/{slug}`(또는 figure 리딩 `/film/{slug}/figure/{fig_slug}`), related 트로프 `/trope/{slug}`, 개념 `/concept/{slug}`(`sm_concepts.slug`), 목록 `/tropes`.
- **env:** 홈/영화와 동일(`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, 서버용 service role).

---

## 8. 메커니즘 (인터랙션)

| 메커니즘 | 동작 |
|---|---|
| 스티키 서브네비 | `position:sticky; top:60px`(네비 높이). 가로 스크롤, 스크롤바 숨김. |
| 스크롤스파이 | `IntersectionObserver`(rootMargin `-120px 0 -65% 0`)로 현재 섹션 링크에 `.on` 토글. 6개 앵커 ↔ 6개 `section[id]`. |
| 앵커 점프 오프셋 | 각 `section[id]`에 `scroll-margin-top:112px`로 제목이 서브네비에 가리지 않게. |
| Connection map | 중심 1(트로프) + 멤버 영화 링 + related 트로프 외곽, `setInterval(4200ms)` 재배치 + `.gfade`. 노드 `<a>` 클릭 진입. 영화 상세 graph JS 재사용(라벨만 교체). |
| The pair | 정적. 반응형(≤1020) 시 2열 → 세로 스택, 중앙 메달리온이 인라인 카드로 전환(`.pairmed` static). |
| CTA "Open the map" | `#map` 앵커로 `scroll-behavior:smooth` 스크롤. |

---

## 9. 구현 체크리스트

- [ ] `/trope/[slug]` 동적 라우트 + SSG/ISR, 404 처리. (라우트 ✅ `/trope/` 단수)
- [ ] 마스트헤드: 라벨(kind) + 제목(title) + gloss(laconic) + 성숙도 배지(maturity 매핑) + 스탯 3개 + CTA.
- [ ] 스탯의 "frameworks" 수: DB distinct framework(3) vs 디자인 값(14) 정책 결정.
- [ ] 스티키 서브네비(top:60px) + 스크롤스파이 + `scroll-margin-top`.
- [ ] Thesis: `meta_takes.thesis`(+essay) 렌더 + AI 임베딩 고지.
- [ ] The pair: `figure_type_members.sim` 상위 2 (또는 큐레이션) + 메달리온 gloss.
- [ ] Films grid: `takes`(trope_id)+`figures`+`films`, via=figure.label, 상한 10 + "See all 61".
- [ ] 8편 "via" 라벨 DB 검증(멤버십·정확 figure 라벨).
- [ ] Frameworks: distinct framework + 카운트. Theory: theorist_id 또는 takes.theorist_name/concept.
- [ ] Connection map: 중심 트로프 + 멤버 영화 + related 트로프, 재배치 애니메이션, 클릭 라우팅.
- [ ] Related: `meta_take_edges` 이웃(film_count 배지) + `sm_concepts` 칩(n 카운트, 실 slug).
- [ ] 편집 출처(created_at / editor).
- [ ] 공유 네비/푸터/토큰/graph JS는 영화·홈과 단일 컴포넌트로.
- [ ] 반응형(1020/680).

## 10. 미해결 (Open questions)
1. **스탯 frameworks 수 정책:** DB 실값(3) vs 전체 분류(14)·디자인 ESTABLISHED 배지 — 어느 쪽을 노출할지 편집 확정.
2. **Films 그리드 멤버십 검증:** 명세 지정 8편(amour, zone-of-interest, still-the-water, a-man-escaped, mouchette, come-and-see, of-gods-and-men, diary-of-a-country-priest)이 실제 이 trope 멤버인지 + 각 via figure 라벨 확정. (Balthazar·Chronicle은 확인됨.)
3. **Related 트로프 일부 존재 확인:** The Held Shot As Ethical Witness / The Person Used Merely As Means의 DB 존재·slug.
4. **개념 라우트 slug:** `sm_concepts.slug`가 인코딩 형태 — `/concept/{slug}`에 그대로 쓰는지, 정규화 slug 컬럼이 따로 있는지.
5. **theorist_id 채움:** `meta_takes.theorist_id`/`theory_family_id`가 null — `theorists` 테이블의 Levinas row 연결 여부.
6. **The pair 선택 로직:** sim 최상위 2 vs "가장 비유사하지만 같은 코드" 큐레이션 — 의도(§2.4)에 맞는 정렬 정의.

---

## 11. 부록 — 이 페이지 CSS 클래스 글로서리
```
.masthead/.mast-bg/.crumb/.thead              마스트헤드(포스터 없음)
.tlabel/.badge/.mtitle/.tgloss                라벨·성숙도 배지·제목·gloss
.statstrip/.s                                 트로프 스탯(3)
.mcta/.b(.primary/.ghost)                     CTA 버튼
.subnav (a.on)                                스티키 서브네비 + 활성
.band(.p2/.dark) / .shead                     섹션 프레임(영화/홈과 공유)
.thesis/.drop/.note                           Thesis/essay(드롭캡 + AI 고지)
.pairwrap/.pairgrid/.pairside(.left/.right)/.pbg/.ph/.pt/.pd/.pv/.pairmed   ONE READING, TWO FILMS
.filmgrid/.fcard/.pp/.ft/.fy/.fvia/.fr        Films that instantiate it
.fwgroup/.fwchips/.c/.b                        프레임워크 칩
.theorist/.av/.tx(.nm/.cn/.lk)                이론가 카드
.graphbox/#graph/.gnode/.gedge/.gfade         Connection map(영화와 공유)
.tropelist/.troperow/.cnt                     Related 트로프 행
.cgroup/.cchips/.b                            Related concepts 칩
.prov                                         편집 출처
footer/.fgrid/.fbrand/.fbar/.tmdb             푸터(영화/홈과 공유)
```

---
*문서 끝. 디자인 의도 §2, 구조 §3, 크기 §4, 데이터·SQL §5/§6, 라우트(✅ `/trope/{slug}` 단수) §7, 인터랙션 §8. 공유 토큰/그래프 JS는 `metatake-film-detail-mockup.html` 기준. 구현은 이 문서 + `metatake-trope-detail-mockup.html`을 1:1로 따라가면 됩니다. 트로프 PK 예시: `a0ada98e-8650-4803-bfbf-3aeec035a081`, slug `the-face-as-infinite-ethical-summons`.*
