# HANDOFF — 두 번째 페이지 (P0) 설계

> **`HANDOFF-회원가입-전환-설계.md` §12 D7의 실행 도면.** D7이 "가입 압박을 늘리지 말고 두 번째
> 페이지를 만들어라"로 방향을 틀었고, 이 문서는 그 P0을 다른 에이전트가 그대로 구현할 수 있게 쓴다.
>
> **상태:** 설계 v1 (2026-08-23). 근거 = mt_events 21~60일 실측 + 코드 실사 + DB 자산 실사.
> **핵심 발견: 만들 게 거의 없다. 이미 있는 자산이 안 보이는 자리에 있을 뿐이다.**

---

## §0. 한 문장 & 불변식

> **읽기의 끝에 놓을 것은 가입 요청이 아니라 다음에 볼 영화다.**
> 방문자의 90%가 정확히 1페이지를 보고 떠난다. 두 번째 페이지가 없으면 가입 후보군 자체가 없다.

**불변식(상위 문서 승계 + 이 층 고유):**
1. **URL 불변** — 신규 라우트 0. 기존 페이지 위에 블록 하나를 얹는다.
2. **서버 HTML 비개인화** — 이 모듈은 익명 전용 콘텐츠(개인화 없음)라 **서버 렌더 가능**하고, 그래야
   크롤러가 내부 링크로 읽는다. JoinCard와 반대 성격이다.
3. **가입 요청은 언제나 다음 읽기 제안 **아래**** — 이 순서를 뒤집는 배치는 금지.
4. **산문 중복 금지** — 같은 영화의 서로 다른 표면에 같은 reason 문장을 반복 노출하지 않는다(§5.3 로테이션).
5. **디자인 헌장 Newspaper v3** — 흰 배경·near-black·단일 적색 `#E3120B`·다크모드 없음.
6. **빈 껍데기 금지** — 추천이 없으면 블록 자체를 렌더하지 않는다(fault-soft).

---

## §1. 왜 이것이 P0인가 (실측, 2026-08-23)

| 지표 | 값 | 출처 |
|---|---|---|
| 실방문자 | 75.2명/일 | `mt_real_visitors_json(14)` |
| 페이지/방문자 | **1.31** | 동일 |
| 세션 깊이 | **90.0%가 정확히 1 PV** (2,511/2,790 세션, 21일) | `mt_events` |
| 2 PV 이상 | 10.0% · 3 PV 이상 **5.7%** | 동일 |
| 체류 중앙값 | 23.4초 · **36.7%가 60초 이상** · 34%가 스크롤 60%↑ | `leave.props.dwell_ms` |
| 주간 재방문자 | W31 5 → W32 17 → W33 26 → **W34 47** | `mt_weekly_return_json` |

**읽는 사람은 실재한다.** 3분의 1이 1분 넘게 머물고 끝까지 스크롤한다. 그들이 다 읽고 나서 갈 곳이 없을 뿐이다.

### 1.1 가입 압박은 이미 한계까지 돌렸고 0이었다 (60일)

| 이벤트 | 노출 | 클릭/전환 | 비율 |
|---|---|---|---|
| `nudge_shown:join:*` (6표면 합) | **1,648회** (고유 ~1,100명) | `nudge_click` **2회** | **0.12%** |
| `onetap:shown` | 759회 (632명) | 기록된 전환 0 | 0% |
| `gate_shown:*` (JIT) | **10회** | `gate_method:*` **4회** | **40%** |

**해석:** JIT 게이트는 전환율 40%로 잘 작동한다. 60일에 10번밖에 안 뜰 뿐이다.
**행동하려는 사람은 가입한다. 행동하려는 사람에 도달하지 못하는 것이 문제다.**
그리고 그 앞단이 "1페이지 보고 이탈"이다. → 넛지 튜닝은 천장이 이미 0이다. **깔때기 입구를 넓혀야 한다.**

### 1.2 반증도 이미 끝나 있다
2026-08-16 하루에 11명이 가입했다. 그중 **9명이 활동 0**, 대부분 그날 이후 재방문 없음.
전체 회원 33명 중 유의미한 활동은 ~9명. 뉴스레터 구독자 4명.
→ **가입 숫자를 늘려도 아무 일도 안 일어난다는 것이 이미 실측됐다.**

---

## §2. 구조적 원인 (코드 실사)

### 2.1 롱테일 페이지의 끝은 "같은 영화의 다른 면" 14개다
`components/read/ReadPlates.tsx` = `/whereto`·`/locations`·`/movies-like`·`/film/*/reception`·
`/film/*/q/*`·`/takescore/film/*` 등 **전 롱테일 표면의 하단 블록**. 구성:
- `About this film` CTA (필름 메인으로 되돌리는 깔때기)
- `More on {film}` — 최대 **14장**(PLATE_CAP=14)의 플레이트: TakeScore·Reception·Misreadings·
  Locations·Lineage·Movies-like·Where to watch·TV·Credits·Curious·데스크 에세이·Daily

**전부 같은 영화다.** "이 영화 어디서 봐?"라는 용무로 온 사람에게 그 영화에 대한 문 14개를 더 여는 것은
용무가 끝난 사람에게 아무 제안도 하지 않은 것과 같다. 실측이 그것을 말한다 —
1페이지 이탈 착지 상위: `/film/*` 787PV · **`/whereto` 367PV(320명)** · `/locations` 244PV(228명) ·
`/movies-like` 128PV · `/director/*` 126PV.

### 2.2 유일한 "다른 영화" 문이 14장 중 1장으로 묻혀 있다
`movies-like` 플레이트 1장. 나머지 13장과 시각적으로 동등. 강조 0.

### 2.3 가입 카드가 탐색 제안보다 **위**에 있다
`ReadPlates.tsx:272` — `JoinCard`가 `About this film` CTA 직후, **`More on {film}` 플레이트 위**에 렌더된다.
즉 "다음에 어디 갈까"를 결정하는 바로 그 순간에 가입 요청이 끼어든다. 이 배치가 §1.1의 0.12%를 만든 자리다.

### 2.4 필름 메인의 "Watch next"는 탭 안에 갇혀 있다
`app/film/[slug]/_shared.tsx:1960` — `<section id="df-watchnext">` "Watch next" 9편,
**각 편마다 LLM이 쓴 bridge 문장(`reason`)**. 카피가 스스로 밝힌다:
*"a reason for each pick, not a distance score."* — 제품의 차별점 그 자체다.
그런데 `FilmTabBar`의 한 탭(`df-watchnext`)일 뿐이고(`:1450`), 탭 클릭 실측은
`tab:df-watch` 5회 · `tab:df-readings` 3회 — 사실상 아무도 탭을 누르지 않는다.

### 2.5 내부 링크 클릭이 계측되지 않는다 (측정 갭)
`mt_events`의 `click`은 `data-mt` 속성이 붙은 요소만 잡는다. ReadPlates 플레이트·Watch next 카드·
connected films 링크에는 `data-mt`가 없다. **그래서 "플레이트가 안 먹힌다"를 지금까지 볼 수 없었다.**
지금 보이는 click 상위가 `map:zoom` 776인 이유가 이것이다 — 맵만 계측돼 있다.

---

## §3. 자산 실사 — 만들 것이 거의 없다

| 자산 | 테이블/RPC | 실측 커버리지 |
|---|---|---|
| **큐레이션 추천 + 이유** | `film_next` (RPC `film_next(p_film_id)`) | **17,317행 / 1,977 소스영화**. `reason` 있는 행 **17,216**. 실제 필름 페이지로 연결되는 행(`target_film_id` not null) **13,620** |
| | | **visible 필름 1,959편 중 1,953편(99.7%)이 연결된 추천 보유** |
| 벡터/트로프 근친 | `film_affinities` (film_id, related_film_id, score, cos, shared_meta_take_ids) | **visible 1,959편 100%** · 평균 cos 0.810 |

**결론: P0은 신규 개발이 아니라 배치·강조·계측 문제다.** 데이터 파이프라인 작업 0, 마이그레이션 0.

---

## §4. 설계 — `NextFilm` 블록

### 4.1 형태
**3장.** 1장은 도박(익명 방문자에 대해 아는 것이 없다), 9장은 지금의 실패(선택 마비 + 메뉴화).
3장은 각 카드에 bridge 문장을 붙여도 조판이 무겁지 않은 최대치다.

```
┌─────────────────────────────────────────────────────────┐
│ WATCH NEXT                                              │  ← 킥커, #E3120B
│ After 《기생충》 — three films that continue its         │  ← 서브헤드
│ conversation, each chosen for a specific bridge.        │
│                                                         │
│ ┌────┐  버닝 (2018)              ┌────┐  플란다스의 개   │
│ │포스│  이창동                    │포스│  봉준호          │
│ │ 터 │  "같은 계급의 문턱을 …"    │ 터 │  "봉준호가 …"    │
│ └────┘                           └────┘                 │
│                            (3열, 모바일 1열 스택)        │
└─────────────────────────────────────────────────────────┘
```

- 포스터 w185 · `loading="lazy"` · 제목 + 연도 + 감독 · **reason 1~2줄(최대 ~140자 클램프)**
- 카드 전체가 `<Link href="/film/{target_slug}">` — 클릭 표적을 최대화
- `target_film_id`가 null인 행은 **제외**(TMDB 외부 링크는 이탈이지 두 번째 페이지가 아니다)

### 4.2 데이터 계약
자급자족 서버 컴포넌트. `ReadPlates`와 동일한 형태 — slug로 fetch, `unstable_cache` 1시간.

```ts
// components/read/NextFilm.tsx  (server component)
export default async function NextFilm({
  slug,            // 소스 영화
  surface,         // "whereto" | "locations" | "movies-like" | "reception" | "q" | "takescore" | "film-main" | …
  variant = "full" // "full" = reason 포함 / "bare" = 포스터+제목만
}: Props)
```

1. `film_next` RPC → `position` 순, `target_film_id != null`, `reason` 있는 행만
2. §5.3 로테이션 오프셋 적용 후 3행 선택
3. `films`에서 `id, title, slug, year, poster_path` 배치 조회 (`.eq("visible", true)`)
4. **폴백:** 1의 결과가 `POOL`(=6) 미만이면 `film_affinities` 상위로 채운다(reason 없는 항목은 해당 카드만 bare)
5. 그래도 0장이면 **null 반환**(빈 껍데기 금지)
6. `filmErr` 발생 시 **throw**(null 캐싱 금지 — `ReadPlates.tsx:loadPlates`가 겪은 함정 그대로. 주석 참조)

### 4.3 i18n
`filmTitle(filmTitles, locale, slug, title)` 기존 헬퍼 사용(제목은 프로젝션 경유).
`reason`은 영어 원문 유지 — ko 번역 레인은 별건이고, 번역 없다고 블록을 죽이지 않는다.

---

## §5. 배치 — **이득의 대부분이 여기 있다**

### 5.1 롱테일 표면 (최우선, 가장 큰 레버)
`ReadPlates` 내부, **`About this film` CTA 바로 다음 / `More on {film}` 플레이트 **위****.
= 현재 `JoinCard`가 앉아 있는 그 자리(`ReadPlates.tsx:272`)를 `NextFilm`이 가져간다.

순서 확정:
```
1. About this film   (같은 영화 메인으로)
2. NextFilm ×3       (다른 영화로)          ← 신규, JoinCard가 있던 자리
3. More on {film}    (같은 영화 심층 14장)
4. JoinCard          (가입)                 ← 맨 아래로 강등
```

### 5.2 필름 메인 (`app/film/[slug]/_shared.tsx`)
**추천 자체는 이미 있으므로 순서만 고친다.** 산문 중복을 만들지 않는다.
- `:2152` `<JoinCard variant="film" source="film-main" />` **바로 위**에
  `<NextFilm slug={film.slug} surface="film-main" variant="bare" />` 삽입
  → `variant="bare"`라 reason 산문이 `#df-watchnext` 섹션과 중복되지 않는다.
- `FilmTabBar` 탭 순서(`:1450`)에서 `df-watchnext`를 **상위로 승격**(현재 사실상 미클릭).

### 5.3 산문 중복 방지 — 표면별 슬롯 + 용량 판정  ⚠️v1 설계 정정(구현 중 발견)

같은 영화의 `/whereto`·`/locations`·`/movies-like`에 동일한 reason이 반복 노출되면 얇은 페이지
중복 산문이 된다. 표면을 **슬롯 0/1/2**에 매핑한다.

```ts
const SLOTS = { whereto:0, reception:0, credits:0, "film-main":0,
                locations:1, takescore:1, lineage:1, desk:1,
                "movies-like":2, q:2, misreadings:2, gallery:2 };
```

🚨 **단순 오프셋(v1의 0/3/6)은 틀렸다.** 실측 분포 — 사용 가능한 추천(`target_slug` 있는 행) 기준
visible 1,955편 중 **9개 이상 32편 · 6~8개 785편 · 3~5개 956편 · 1~2개 169편**.
즉 **58%가 5개 이하**라 오프셋이 제자리로 감겨 같은 산문이 두 표면에 그대로 나온다.

**정정된 규칙:**
```
capacity = floor(pool.length / 3)
slot < capacity  → pool.slice(slot*3, slot*3+3)   … 고유 3편 + reason 산문
slot >= capacity → 순환해서 3편은 채우되 **reason을 렌더하지 않는다(bare)**
```
링크(다음 영화로 가는 문)는 항상 3개 서고, **산문은 서로 겹칠 수 없다.**
전 풀 크기(1~9)에 대해 시뮬레이션 검증 완료 — 겹침 0·빈 블록 0.

**풀 목표 `POOL = 6`** (두 슬롯분). 세 번째 고유 집합까지 노리면 top-up 쿼리가 1,138편이 아니라
**1,923편**에서 발화한다 — DB 포화 이력이 있는 저장소에서 작은 이득을 콜드캐시 읽기로 사는 것은 금지.
고트래픽 표면인 slot 0(whereto)·slot 1(locations)이 고유 집합을 갖고, slot 2(movies-like)는 bare로 돈다.

### 5.4 감독 표면
`DirectorPlates.tsx:131`의 `JoinCard`도 동일하게 맨 아래로. `director_next` 테이블이 있으므로
감독판 `NextFilm`은 **P1로 이월**(P0 범위 밖 — 롱테일 필름 표면이 트래픽의 대부분이다).

---

## §6. 카피

| 자리 | 문구 |
|---|---|
| 킥커 | `WATCH NEXT` |
| 헤드(full) | `After {title} — three films that continue its conversation.` |
| 서브(full) | `Each chosen for a specific bridge, not a distance score. Argued by Metatake AI.` |
| 헤드(bare) | `Watch next` |
| 카드 | `{제목} ({연도})` · `{감독}` · `{reason 클램프}` |

기존 `df-watchnext` 카피(`_shared.tsx:1962`)와 동일 어휘를 쓴다 — 새 어휘를 만들지 않는다.
⚠️ [[prompt-wording-becomes-corpus-tic]] 교훈: 이 문구는 코퍼스에 들어가지 않는 UI 카피이므로 안전.

---

## §7. 계측 — 측정 갭부터 수리

`data-mt` 속성만 붙이면 기존 비콘이 그대로 잡는다. **신규 코드·스키마 변경 0.**

| 요소 | `data-mt` |
|---|---|
| NextFilm 카드 | `next:{surface}:{pos}` (pos = 1\|2\|3) |
| NextFilm 블록 노출 | `next_shown:{surface}` (마운트 시 1회, JoinCard 패턴 차용) |
| ReadPlates 플레이트 | `plate:{surface}:{kind}` — **여기서 처음으로 플레이트 CTR이 보인다** |
| 필름 메인 connected films | `conn:{pos}` |
| Watch next 탭 카드 | `wn:{pos}` |

> ⚠️ `mtEvent()`는 페이지당 1회 dedupe이므로 노출 이벤트는 블록 단위 1회만 발사한다.
> ⚠️ 카드 클릭은 `data-mt`(비콘이 자동 포착)로, 노출은 `mtEvent()`로 — 둘을 섞지 않는다.

---

## §8. 구현 단계

| 단계 | 내용 | 파일 | 크기 |
|---|---|---|---|
| **S1** | `NextFilm` 서버 컴포넌트 신설(§4.2 계약·폴백·throw 규율) | `components/read/NextFilm.tsx` (신규) | 중 |
| **S2** | ReadPlates 배치 교정 — NextFilm 삽입 + JoinCard 맨 아래로 | `components/read/ReadPlates.tsx` | 소 |
| **S3** | 계측 부착 — `data-mt` 5종 | ReadPlates · NextFilm · `_shared.tsx` | 소 |
| **S4** | 필름 메인 — bare NextFilm 삽입 + 탭 순서 승격 + JoinCard 아래로 | `app/film/[slug]/_shared.tsx` | 소 |
| **S5** | DirectorPlates JoinCard 강등(감독 NextFilm은 P1) | `components/read/DirectorPlates.tsx` | 극소 |

**마이그레이션 0 · 신규 라우트 0 · 워커 변경 0.**

**배포 규율:** `components/`·`app/` = 자동배포 워처가 잡음 → **staging**(main 직접 금지).
루트 문서(이 파일)는 수동 커밋. tsc 래칫 20 유지 — `./node_modules/.bin/tsc --noEmit`로 직접 실행할 것
(`timeout npx tsc`는 이 저장소에서 조용히 실행조차 안 된다).
작은 UI 변경이므로 오너 지침에 따라 `next build` 생략, tsc 래칫만.

---

## §9. 성공 기준 · 가드레일 · 롤백

**1차 판정 (배포 +14일)** — 이것부터가 지금까지 볼 수 없던 숫자다
- `next:*` CTR **≥ 8%** (비교군: `nudge_click` 0.12%)
- `plate:*` CTR이 처음으로 관측됨 → 플레이트 14장의 실제 가치 판정 가능

**2차 판정 (+28일)**
- PV/방문자 **1.31 → 1.8**
- 2 PV 이상 세션 **10.0% → 20%**

**3차 판정 (+56일)**
- 주간 재방문자 **47 → 90** (현 추세 W31 5→W34 47 위에)
- `gate_shown:*` 60일 10회 → **주 10회** (깔때기 입구가 넓어졌다는 증거)

**🚨 가드레일(하나라도 깨지면 롤백):**
- 심독률(dwell 60초+ 비율)이 **36.7% → 30% 미만**으로 하락 = 조판을 망친 것
- Bing/DDG 유입 주간 합계가 **-20%** 이상 하락 = 내부 링크 구조를 잘못 건드린 것
- 프로덕션 504 비율 상승 = `film_next` 조회가 캐시를 못 타는 것 → `unstable_cache` 확인

**롤백:** S2/S4의 배치 교정만 되돌리면 즉시 원복(컴포넌트는 남겨도 무해).

---

## §10. 하지 말 것

- 🚫 **하드 로그인 게이트** — D7에서 기각. 근거는 `HANDOFF-회원가입-전환-설계.md` §15.
- 🚫 **JoinCard를 NextFilm 위로** 되돌리기 — 이 문서의 존재 이유가 그 순서다.
- 🚫 **무한 스크롤·자동 추천 피드** — [[discovery-feed-plan]] 오너 지시로 중단된 영역.
- 🚫 **서버 HTML 개인화** — NextFilm은 익명 공통 콘텐츠라서 서버 렌더가 허용되는 것이다.
  로그인 상태에 따라 내용이 바뀌면 즉시 불변식 위반.
- 🚫 **신규 URL·리다이렉트·noindex 변경** — 구글 회복 판정 창(첫 판정 2026-08-31) 중이다.
- 🚫 **exit-intent** — D4에서 이미 기각(Balanced).

---

## §11. 개정 로그
- **2026-08-23 v1** — 최초 설계. mt_events 21~60일 실측 + 코드 실사(ReadPlates·_shared·EntityActions) +
  DB 자산 실사(`film_next` 99.7% 커버리지 발견). D7 방향 전환의 실행 도면.
- **2026-08-23 v2 — S1~S5 구현 완료.** §5.3 로테이션 규칙 정정(단순 오프셋 → 슬롯+용량판정): 실측 분포에서
  **58%의 영화가 사용가능 추천 5개 이하**라 오프셋이 감겨 산문이 중복되는 결함을 구현 중 발견. `POOL=6`.
  tsc 래칫 20/20 유지. 신규 `components/read/NextFilm.tsx`·`NextFilmBeacon.tsx`,
  수정 `ReadPlates.tsx`·`DirectorPlates.tsx`·`curious/ui.tsx`(Card `mt` prop)·`film/[slug]/_shared.tsx`.
