# HANDOFF — 홈 리디자인 V5 "Living Paper" 시안 가이드

> **읽는 대상: 이 작업을 이어받는 다른 AI.**
> 이 문서 하나만 읽고 바로 따라 할 수 있도록, 시안의 위치 · 의도 · "반드시 우리 사이트에 맞춰 고쳐야 하는 것"을
> 전부 적었다. 경로는 전부 이 컴퓨터(macOS, 같은 Claude 프로젝트) 기준 절대경로다.

---

## 0. 한 줄 요약

`home-redesign-v5-living-paper.html`은 **금욕적인 학술 신문처럼 보이지만 몰래 살아 움직이는** Metatake 홈페이지
**시안(컨셉 목업)** 이다. 디자인 방향과 인터랙션(실시간 카운터, 살아있는 임베딩 그래프, 점점점 스트리밍)은 그대로
가져가되, **로고·상단 메뉴·영화 피처·우측 메타테이크/트로프 예시의 "내용"은 전부 가짜(placeholder)이므로 우리
사이트의 실제 데이터·구조에 맞게 교체**해야 한다.

---

## 1. 파일 위치

| 파일 | 경로 | 비고 |
|---|---|---|
| **V5 시안 (대상물)** | `/Users/jerryje/Documents/filmcurio/home-redesign-v5-living-paper.html` | 단일 HTML. 의존성 없음. 브라우저로 바로 열림 |
| 이 가이드 | `/Users/jerryje/Documents/filmcurio/HANDOFF-home-v5-시안-가이드.md` | 지금 읽는 문서 |
| (참고) V4 이전 시안 | `/Users/jerryje/Documents/filmcurio/home-redesign-v4-living-paper.html` | V5의 직전 버전. 무시해도 됨 |

브라우저에서 열어 동작을 먼저 확인할 것: 페이지 새로고침마다 featured가 랜덤으로 바뀌고, 카운터가 차오르며,
검은 그래프 창을 드래그/줌 할 수 있고, 하단 "Just added"가 7초마다 갈린다.

---

## 2. 상태 = 시안. "진짜"와 "가짜"를 구분하라

이 시안에서 **레이아웃·인터랙션·디자인 토큰은 진짜로 쓸 것**이고, **글·숫자·예시 데이터는 전부 자리표시자**다.

- ✅ 그대로 유지: 디자인 시스템(흰 종이 · 잉크 블랙 · **빨강 단 하나 #E3120B** · PT Serif/Inter · 헤어라인 · 사각
  모서리 · 스틸 흑백 처리), 6개 모듈 구성, 4가지 살아있는 인터랙션(아래 §3).
- ❌ 교체 대상(가짜): 상단 로고/메뉴, 영화 피처 본문(pitch·record·figures·동급작·레벨), 우측 메타테이크
  예시(laconic·thesis·defining cases·register·kin), 카운터 숫자, "Just added" 풀의 항목들, 임베딩 사양 숫자.

> 핵심 원칙: **"우리 사이트에 이미 존재하는 페이지의 스크린샷"처럼 보이게** 만들어야 한다. 지금은 그럴듯한
> 가짜다. 진짜 DB/페이지 내용으로 바꿔라.

---

## 3. 반드시 살려야 할 것 (시안의 핵심 = 와우 포인트)

이 네 가지가 "금욕적 종이가 살아 숨 쉰다"는 인상을 만든다. 구현을 바꾸더라도 효과는 유지하라.

1. **실시간 계기판** — 상단 카운터가 0→목표로 차오르고, 이후 Takes/Nodes가 가끔 ↑틱.
2. **살아있는 임베딩 그래프(검은 창)** — 흰 페이지 속 유일하게 색이 빛나는 한 곳. Film ⇄ Figure 토글, 드래그·줌·
   노드 클릭으로 "여행". (실제 구현 시 `figure-graph-obsidian.html` / `film-graph-obsidian.html`의 포스 그래프를
   재사용 가능 — 이미 같은 폴더에 있음.)
3. **점점점(streaming dots)** — 목록 각 항목이 참조 영화 5개를 점 하나씩 떠올림.
4. **랜덤** — featured 영화·메타테이크는 로드/↻ 시 랜덤, "Just added"는 7초마다 랜덤 순환.

디자인 토큰 출처(절대 새로 만들지 말 것): `/Users/jerryje/Documents/filmcurio/app/globals.css`
(빨강 `--accent:#E3120B`, `--ink:#0D0D0D`, 폰트 `--font-display`/`--font-ui`, 헤어라인 등).

---

## 4. ★ 반드시 우리 사이트에 맞춰 고칠 것 (작업의 본체)

각 항목: **(지금 시안 상태) → (진짜 소스) → (해야 할 일).**

### 4.1 로고 + 상단 메뉴 순서 → 실제 사이트와 동일하게

- **지금 시안(가짜):** 좌상단에 빨강 2줄 박스 로고 `META / TAKE`, 메뉴 `The Latest · Films · Tropes · Meta-takes ·
  Graph · About`, 우측 `Sign in`. → **전부 임의로 만든 것이라 틀림.**
- **진짜 소스:** `/Users/jerryje/Documents/filmcurio/components/MetatakeNav.tsx`
- **해야 할 일 — 아래 실제 마스트헤드를 그대로 반영:**
  - 로고 = **소문자 텍스트 워드마크 `metatake`** (빨강 박스 아님). 클래스 `.brand`, 링크 `/`.
  - 메뉴 순서(정확히 이 순서·라벨): **`Ask` · `Latest` · `Trending` · `Films` · `Directors` · `Tropes` ·
    `Meta takes`**
    - 링크: `/ask` · `/latest` · `/trending` · `/film` · `/director` · `/tropes` · `/meta-takes`
  - 우측: **Search · Random(주사위 메뉴) · Account 메뉴** (`SearchBox` · `RandomMenu` · `AccountMenu`).
  - 시안의 `Graph`/`About` 상단 항목, 빨강 박스 로고, `Sign in` 버튼은 실제와 다르므로 위 구성으로 교체.

### 4.2 영화 설명(피처) 페이지 → 우리 컨텐츠에 더 가깝게

- **지금 시안(가짜):** 좌측 "Featured film" 카드의 Why watch(pitch)·The record(Premiere/Box office/Awards)·The
  figures·Comparable·Experience 레벨은 **내가 지어낸 예시 문구/숫자**다(터미네이터·조커 등).
- **진짜 소스:**
  - 영화 페이지 구조: `/Users/jerryje/Documents/filmcurio/app/film/[slug]/page.tsx`
    (실제 섹션: 헤더 → Film info → **Figures** → **Meta takes** → **Tropes** → **Films most connected to …**)
  - 피처 설계·스키마: `/Users/jerryje/Documents/filmcurio/film-features-plan.md`
    - 고정 피처 4종(kind): **`pitch`(Why watch, 스포일러 0) · `record`(팩트시트 jsonb) · `reception`(수용사) ·
      `experience`(aesthetic_level 1–10 + label + comparables 5)**
    - 스키마: `film_features(film_id, kind, body, payload jsonb, …)`, `films.aesthetic_level/aesthetic_label`
- **해야 할 일:**
  1. 시안의 지어낸 pitch/record/figures/comparables/level 문구를 **실제 `film_features`·`figures` 데이터로 교체**
     (실제 영화 한 편을 골라 그 영화의 진짜 payload를 넣을 것).
  2. 카드의 섹션 라벨·순서를 실제 영화 페이지 흐름(Why watch → record → experience → figures)과 일치시키되,
     **figures는 실제 figure label + `/film/[slug]/figure/[figure-slug]` 링크**로.
  3. "Read the full film →"는 `/film/[slug]`로.

### 4.3 우측 메타테이크 / 트로프 예시 → 실제 페이지 내용과 일치

- **지금 시안(가짜):** 우측 "Featured meta-take" 카드의 제목·laconic·thesis·Defining cases·register 배지·Unexpected
  kin은 **전부 지어낸 것**. register 키/색상도 임의값이라 **실제와 다름**.
- **진짜 소스:**
  - 메타테이크(허브) 페이지: `/Users/jerryje/Documents/filmcurio/app/take/[slug]/page.tsx`
    (실제 흐름: `mt-h1` 제목 → `mt-laconic` → **thesis** 문단 → **Representative takes** → **Defining cases** +
    **Unexpected kin**("far apart on the surface, family underneath") → **All takes of "…" — N across M films**
    (TakeExplorer, 장르/레지스터 폴더) → Compare/Contrast → NodeGraph). 라우트는 **`/take/[slug]`**.
  - 트로프 페이지: `/Users/jerryje/Documents/filmcurio/app/trope/[slug]/page.tsx`
    (실제 헤더 `Trope · figure-type`, `Figures`/`Films` 카운트, `Figures of {제목} — N across M films`). 라우트는
    **`/trope/[slug]`**, 목록은 **`/tropes`**.
- **해야 할 일:**
  1. 카드 내용을 **실제 `meta_takes`(title·laconic·thesis)** + **실제 랭킹된 take(`meta_take_rankings`)** 로 교체.
  2. **register 배지는 아래 실제 매핑을 그대로 사용**(키·라벨·HEX 모두 실제 코드 `app/take/[slug]/page.tsx`의
     `REG`에서 가져옴 — 시안의 값은 폐기):

     ```
     formal            Formal            #5B8FB9
     semiotic          Semiotic          #B8860B
     psychoanalytic    Psychoanalytic    #A8434F
     ideological       Ideological       #C0392B
     politico_economic Politico-economic #2E7D5B
     philosophical     Philosophical     #7E57C2
     existential       Existential       #546E7A
     mythic            Mythic            #A9743B
     genealogical      Film-historical   #2E86C1
     reception         Reception         #159A8A
     ```
  3. 우측 카드는 (직전 결정대로) **랜덤 메타테이크**를 보여준다. 단, 트로프 예시도 같은 원칙 — 보여줄 때는
     **반드시 실제 `/take`·`/trope` 페이지의 실제 내용**이어야 한다(지어내기 금지).

### 4.4 카운터 · "Just added" · 임베딩 사양 숫자 → 실제 데이터로

- **지금 시안(가짜):** Films 567 / Figures 4,626 / Takes 13,241 / Meta-takes 152 / Tropes 96 / Nodes 5,441,
  임베딩 사양(1,536 dims, 0.86, 18,907 soft edges), "Just added" 풀 항목 — 전부 그럴듯한 자리표시자.
- **진짜 소스:**
  - 홈 데이터 RPC: `home_payload` (이미 `tropeCount`, `readingCount` 반환) — `app/page.tsx` 및
    `/Users/jerryje/Documents/filmcurio/supabase/migrations/0023_trending.sql`, `0024_graph_seeds.sql`
  - 그래프 이웃 RPC: `0018_graph_neighbors.sql`(`graph_film_neighbors` 등), 그래프 시드 `0024_graph_seeds.sql`
- **해야 할 일:** 카운터를 실제 카운트(`films`, `figures`, `takes`, `meta_takes`, tropes, nodes)에 연결.
  "Just added"는 실제 최신 트로프/메타테이크로. 임베딩 사양 문구는 실제 파이프라인 값과 맞추거나(임베딩 모델
  `text-embedding-3-small` = 1,536 dims는 사실), 불확실하면 과장 숫자는 빼라.

---

## 5. 사이트 구조 레퍼런스 (이걸 이해해야 시안을 못 망친다)

**엔티티 4층:** `film → figure → take → meta-take` (+ `trope`는 figure의 한 종류이자 별도 허브).

| 엔티티 | 의미 | 페이지 라우트 |
|---|---|---|
| film | 영화 | `/film/[slug]` |
| figure(형상) | 영화가 반복해 돌아오는 구체 요소(사물·몸짓·색·인물·트로프·형식) | `/film/[slug]/figure/[figure-slug]` |
| take(밝힘) | 한 figure에 대한 가까이 읽기 1개(근거 필수, register 분류) | (figure 페이지 내 카드) |
| meta-take(허브) | 같은 읽기가 여러 영화를 가로지를 때 떠오르는 연결 개념 = **사이트의 주인공** | `/take/[slug]` |
| trope | figure-type 허브 | `/trope/[slug]`, 목록 `/tropes` |
| meta-take 목록 | | `/meta-takes` |

권위 문서(개념·로직 총정리): `/Users/jerryje/Documents/filmcurio/MASTER.md`,
IA: `/Users/jerryje/Documents/filmcurio/site-ia-plan.md`,
매니페스토/카피: `/Users/jerryje/Documents/filmcurio/Metatake_소개_매니페스토_제안.md`.

**브랜드 주의:** 사이트명은 **FilmCurio**, 제품 개념은 **Metatake**로 문서마다 혼재. 상단 워드마크는 현재 코드 기준
소문자 `metatake`. 어느 이름으로 표준화할지는 미정이니 **임의로 정하지 말고 기존 코드(`MetatakeNav.tsx`)를 따를 것.**

---

## 6. 먼저 읽어야 할 소스 파일 (순서대로)

1. `/Users/jerryje/Documents/filmcurio/home-redesign-v5-living-paper.html` — 대상 시안(이걸 고친다)
2. `/Users/jerryje/Documents/filmcurio/components/MetatakeNav.tsx` — 진짜 로고·메뉴(§4.1)
3. `/Users/jerryje/Documents/filmcurio/app/page.tsx` — 현재 실제 홈(데이터 RPC `home_payload`, hm-* 클래스)
4. `/Users/jerryje/Documents/filmcurio/app/globals.css` — 디자인 토큰(절대 새로 만들지 말 것)
5. `/Users/jerryje/Documents/filmcurio/app/film/[slug]/page.tsx` + `film-features-plan.md` — 영화 피처(§4.2)
6. `/Users/jerryje/Documents/filmcurio/app/take/[slug]/page.tsx` — 메타테이크 + register 매핑(§4.3)
7. `/Users/jerryje/Documents/filmcurio/app/trope/[slug]/page.tsx` — 트로프(§4.3)
8. `/Users/jerryje/Documents/filmcurio/MASTER.md` — 전체 개념·파이프라인(맥락)
9. (그래프 재사용) `/Users/jerryje/Documents/filmcurio/film-graph-obsidian.html`,
   `/Users/jerryje/Documents/filmcurio/figure-graph-obsidian.html`

---

## 7. 작업 순서 (이대로 따라 하면 된다)

1. 시안을 브라우저로 열어 동작·의도를 파악한다(§3의 4가지 인터랙션).
2. **§4.1 로고/메뉴**부터 교체 — `MetatakeNav.tsx`의 워드마크·순서·우측 액션을 시안 마스트헤드에 1:1 반영.
3. **§4.3 우측 메타테이크 카드** — 실제 `meta_takes` 한 건 + 실제 랭킹 take로 채우고, **실제 REG 색상표**로
   register 배지 교체. 라우트 `/take/[slug]`, 트로프는 `/trope/[slug]`.
4. **§4.2 좌측 영화 피처 카드** — 실제 영화 한 편의 `film_features`(pitch/record/experience) + 실제 figures로 교체.
5. **§4.4 카운터·Just added·임베딩 숫자** — 실제 카운트/최신 항목으로. 불확실한 과장 숫자는 제거.
6. **유지 검증** — 빨강은 여전히 한 곳(+그래프 창)뿐인지, PT Serif/Inter·헤어라인·스틸 흑백이 유지되는지,
   4가지 인터랙션이 살아있는지 확인.
7. (선택) 실제 `app/page.tsx`로 이식: 서버에서 `home_payload`(+추가 카운트/그래프 RPC) → 컴포넌트화 →
   featured 랜덤은 서버 랜덤 또는 클라이언트 셔플, 그래프는 `NodeGraph`/obsidian 포스 그래프 재사용.

---

## 8. 인수 체크리스트 (완료 기준)

- [ ] 상단 로고가 소문자 `metatake` 워드마크다(빨강 박스 아님).
- [ ] 메뉴가 `Ask · Latest · Trending · Films · Directors · Tropes · Meta takes` 순서·링크다.
- [ ] 우측에 Search · Random · Account가 있다(Sign in 버튼 단독 아님).
- [ ] 좌측 영화 카드의 pitch/record/figures/동급작/레벨이 **실제 DB 데이터**다(지어낸 문구 0).
- [ ] 우측 메타테이크 카드의 title/laconic/thesis/cases/kin이 **실제 데이터**다.
- [ ] register 배지가 **실제 REG 키·라벨·HEX**(§4.3 표)와 일치한다.
- [ ] 라우트가 실제와 일치: 메타테이크=`/take/[slug]`, 트로프=`/trope/[slug]`, 영화=`/film/[slug]`.
- [ ] 빨강(#E3120B)은 UI에서 한 곳 + 그래프 창에서만 빛난다(절제 유지).
- [ ] 실시간 카운터 · 임베딩 그래프(Film/Figure 토글) · 점점점 · 랜덤 4가지가 모두 동작한다.
- [ ] 새로 만든 색·폰트가 없다(전부 `globals.css` 토큰 사용).

---

## 9. 하지 말 것 (가드레일)

- 빨강을 두 번째 강조색으로 늘리지 말 것. "빨강은 하나"가 정체성이다.
- 영화 스틸을 컬러로 두지 말 것(흑백 처리 유지 — 빨강 규율 보호).
- 라우트·엔티티 용어를 새로 발명하지 말 것(위 §5 표가 정답).
- pitch/laconic/thesis/cases를 **추측으로 채우지 말 것** — 반드시 실제 데이터에서 가져온다(사실 오류는 고치고,
  해석은 실제 페이지 것을 그대로).
- 시안의 가짜 숫자(특히 임베딩 "soft edges" 같은 값)를 그대로 게시하지 말 것.
```
