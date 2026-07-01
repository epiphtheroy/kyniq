# MetaTake — 개인화 페이지 기획안: 영화 자산관리 터미널

*작성 2026-06-24. 블룸버그식 "영화 자산 포트폴리오" 개인화 페이지의 화면 구조·DB 스키마·수치 체계 기획서. 기존 엔티티 모델(`film → figure → take → trope`), `film_asset`/`film_next` 도시에, `user_pins`/`/me`/`/u/[username]` 위에 얹는다. 짝 문서: `00-INDEX.md`, `docs/STATE-2026-06-17.md`, `docs/ROADMAP-after-big-task.md`.*

---

> ## ⚠ DB 정합 정정 (2026-06-25, 라이브 Supabase 실측 후)
>
> 이 기획서는 *greenfield*를 가정해 작성됐으나, 실측 결과 **substrate 대부분이 이미 존재한다.** §3(데이터 모델)은 *설계 의도*로만 읽고, **실재 스키마는 아래 매핑을 따른다.** 권위 있는 데이터 모델 = `docs/logic/BUILD-ORDER.md` + `docs/logic/0N-*.md`(엔진 명세).
>
> | 본 기획서 제안 | 라이브 실재 | 조치 |
> |---|---|---|
> | `user_films`(status enum, 평점 1–10) | **`user_movies`**(`seen`·`watchlist` bool · `rating`(0–5 별점) · `watched_at`·`note`·`visibility`) + `app/api/track` API + `/me` 표시 | **user_movies 사용.** status→seen/watchlist 매핑, **평점 스케일 0–5↔1–10 표준화 1건** |
> | `user_taste_profile`(신설) | **없음** | 신설 필요 — 컬럼은 명세 `01-taste-vector.md` 따름 (엔진① = W1 키스톤) |
> | `film_scores`(신설 예정) | **이미 존재 5,985행** (prestige/discovery/total/components 1:1 일치) | *재계산 아님 — 재캘리브레이션*(p90=51 → top≈90). 엔진② |
> | `film_affinities`(신설) | **이미 채워짐 38,800행** (shared_meta_take_ids·shared_list_ids·lineage_score) | 엔진⑥은 *블렌드·검증*만 |
> | RPC `set_film_status`/`get_my_films`/… | `app/api/track` 일부 존재, `score_watchlist`/`refresh_taste_profile` 미구현 | 명세대로 신설 |
> | (기획서 미인지) | **`film_watch_providers`**(스트리밍 1,840) · **`film_ratings`**(imdb/rt/meta 1,942) · **`film_next`**(영화→영화 +reason 9,846) · **`director_next`**(감독→감독 1,011) · **`meta_take_edges`**(19,765) · **`user_saves`**(다형 저장) | 설계에 반영됨 — `BUILD-ORDER.md` §1·§1b·§1c |
>
> 요컨대: **빠진 건 "취향→추천" 위층 한 겹**(엔진① 취향 벡터 + ⑤ 조합)뿐. 시장가·임베딩·계보·유사그래프·스트리밍·외부평점·척추는 다 있다.

---

확정된 방향(2026-06-24 결정):
- **페이지 성격** — 비공개 분석 터미널 + 공개 전시 포트폴리오를 **둘 다, 분리 설계**.
- **수치 무게중심** — 취향 포트폴리오 분석과 후보별 "왜 봐야 하나" 점수를 **둘 다, 서로 연동**(분석이 점수의 기준이 됨).
- **이번 산출물** — 본 기획안 문서.

---

## 1. 한 줄 정의와 메타포 매핑

> **MetaTake 개인화 = "영화를 지적·미학적 자산으로 보유·관리하는 터미널."**
> 다른 어떤 영화 사이트보다 *내가 본 영화*와 *내가 볼 영화*가 체계적으로 계량·연결되어 있다.

블룸버그 자산관리 ↔ MetaTake 대응:

| 블룸버그 개념 | MetaTake 대응 | 이미 있는 토대 |
|---|---|---|
| 자산(asset) | **영화 1편** = 지적·미학적 자산 | `film_asset` 도시에(9개 렌즈)가 이미 가치를 계량화 |
| 보유 포트폴리오 | **본 영화**(watched) | `user_pins`(follow/like)를 상태 레이어로 확장 |
| 워치리스트/파이프라인 | **볼 영화**(watchlist) | 신설 |
| 종목 리서치 리포트 | 영화 상세 + Why-watch 도시에 | `/film/[slug]`, `film_asset` |
| 애널리스트 추천(BUY) | **"왜 봐야 하나" 점수** | `film_next`(Trust Mediator 계보 추천) 확장 |
| 상관관계/네트워크 | **그물망** 연결맵 | `EntityGraph`(옵시디언식 force graph) |
| 섹터/팩터 노출 | 취향 분포(감독·국가·연대·오독 렌즈·전통) | 집계 RPC 신설 |

핵심 통찰: **영화마다 "자산 가치"는 이미 도시에로 서술되어 있다.** 빠진 것은 (1) 본/볼 **상태 레이어**, (2) 보유분을 합산한 **포트폴리오 계량**, (3) 그것을 한눈에 보는 **터미널 화면**, (4) 보유분을 기준 삼아 후보를 채점하는 **연동 점수 엔진**이다.

---

## 2. 정보 구조 (IA) — 두 면 분리

같은 데이터(`user_films`)를 두 표면이 다르게 소비한다.

### A. 비공개 — 자산관리 터미널 `/me`
대시보드 본체. 분석·진단·의사결정용. 밀도 높은 멀티패널. 로그인 필수, `noindex`.

| 라우트 | 역할 |
|---|---|
| `/me` | **터미널 홈** — KPI 스트립 + 포트폴리오 구성 + 워치리스트 랭킹 + 그물망 요약 |
| `/me/portfolio` | **보유분 심층** — 본 영화 전체, 다축 분포, 편향·공백 진단, 취향 시그니처 |
| `/me/watchlist` | **파이프라인** — 볼 영화 랭킹 테이블(점수순), 사유·우선순위 관리 |
| `/me/film/[slug]` *(선택)* | 한 보유 자산의 개인 기록(평점/관람일/장소/메모/다시보기) 편집 |
| `/settings` | 기존 — 프로필/공개 범위 토글 추가 |

> 현재 `/me`는 단순 리스트(Following/Liked/My takes). 이를 **터미널 홈으로 승격**하고, 기존 핀 리스트는 한 패널로 흡수.

### B. 공개 — 전시 포트폴리오 `/u/[username]`
큐레이션된 명함. 남에게 보여주는 면. 분석 노이즈를 걷어내고 **취향의 초상**만 전시. 공개 토글 ON일 때만 색인.

| 라우트 | 역할 |
|---|---|
| `/u/[username]` | **취향 초상** — 한 줄 시그니처 + 상위 보유작 + 분포 요약 도넛 + 공개 그물망 |
| `/u/[username]/films` | 공개된 본 영화 그리드(포스터 월, 정렬/필터) |

공개/비공개 경계: `user_films.visibility`(`private`/`public`)로 영화 단위 제어 + `profiles.portfolio_public` 전체 토글. 평점·메모는 기본 비공개, "본 영화" 사실과 시그니처만 공개가 기본값.

---

## 3. 데이터 모델 (DB 스키마)

Supabase Postgres. 기존 `profiles`, `films`, `figures`, `takes`, `meta_takes`(`kind='figure_type'`=trope), `user_pins` 위에 추가.

### 3.1 `user_films` — 보유/관심 상태 레이어 (핵심 테이블)

```sql
create table public.user_films (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  film_id      uuid not null references public.films(id) on delete cascade,
  status       text not null check (status in ('watched','watchlist','watching','dropped')),
  -- 보유 기록 (watched)
  rating       smallint check (rating between 1 and 10),   -- 개인 평점(선택)
  watched_at   date,                                       -- 관람일(선택)
  venue        text check (venue in ('theater','streaming','physical','festival','other')),
  rewatch      smallint not null default 0,                -- 다시보기 횟수
  note         text,                                       -- 개인 메모(비공개 기본)
  -- 파이프라인 기록 (watchlist)
  priority     smallint check (priority between 1 and 3),  -- 1=긴급 2=보통 3=언젠가
  reason       text,                                       -- 담은 이유(자유서술)
  source       text,                                       -- 어디서 발견(예: film_next, 그물망, 검색)
  -- 공개 제어 / 메타
  visibility   text not null default 'private' check (visibility in ('private','public')),
  added_at     timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, film_id)
);
create index idx_user_films_user_status on public.user_films (user_id, status);
create index idx_user_films_film on public.user_films (film_id, status);

alter table public.user_films enable row level security;
create policy "user_films: rw own" on public.user_films for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- 공개 전시용: 본인 외에는 visibility='public' 행만 read
create policy "user_films: read public" on public.user_films for select
  using (visibility = 'public');
```

설계 노트:
- **한 영화 = 한 행, status로 면 전환**(watchlist→watched 승격 시 같은 행 update). 상태 이력이 필요하면 `user_film_events` 로그 테이블을 Phase 4에서 추가.
- `user_pins`(follow/like)는 **그대로 유지** — "like"는 공개 좋아요 카운트, `user_films`는 사적 자산 상태로 역할 분리. `/me`에서 둘을 함께 노출.
- 평점은 **10점 척도**(도시에 톤과 맞춤). 별점은 표시 레이어에서 변환.

### 3.2 `user_taste_profile` — 취향 시그니처 캐시 (계산 결과 저장)

매 페이지뷰마다 전 보유분을 재집계하면 비싸다. 보유분 변경 시 갱신되는 **머티리얼라이즈 캐시**.

```sql
create table public.user_taste_profile (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  taste_vector   vector(1536),   -- 본 영화 takes/figures 임베딩의 (평점가중) centroid
  watched_count  int  not null default 0,
  dist_decade    jsonb,          -- {"1990s":12, "2000s":31, ...}
  dist_country   jsonb,          -- {"FR":18,"KR":22,"JP":9,...}
  dist_director  jsonb,          -- 상위 감독 + 편수
  dist_framework jsonb,          -- {"psychoanalysis":40,"ontology":12,...} (오독 렌즈 노출)
  dist_tradition jsonb,          -- meta_takes.tradition 분포
  dist_trope     jsonb,          -- 상위 트로프(figure_type) 노출
  signature      text,           -- LLM 1줄 취향 요약(선택, 갱신 시 생성)
  refreshed_at   timestamptz not null default now()
);
```

- `taste_vector`: 보유 영화들에 속한 published `takes.embedding`(또는 `figures.embedding`)의 평균. 평점이 있으면 가중. pgvector로 후보 affinity 코사인 계산의 **기준 벡터**가 된다 → 4.2 점수와 직접 연동.
- 갱신: `user_films` insert/update/delete 트리거 → `refresh_taste_profile(uid)` 호출, 또는 지연 TTL(예: 15분). 홈 카운트의 `refresh_home_cache()` 패턴과 동일.

### 3.3 신설 RPC

| RPC | 입력 | 반환 | 용도 |
|---|---|---|---|
| `set_film_status(film_id, status, …)` | 상태/기록 | void | 영화 페이지 버튼 → 보유/관심 토글 |
| `get_my_films(status?)` | 상태 필터 | 영화 + 개인기록 enrich(title/slug/year/poster) | `/me/portfolio`, `/watchlist` |
| `refresh_taste_profile(uid)` | — | void | 보유 변경 시 시그니처 재계산 |
| `portfolio_breakdown(uid)` | — | 분포 jsonb 묶음 + 공백 진단 | 포트폴리오 패널 |
| `score_watchlist(uid)` | — | 후보별 WWI + 서브점수 + 사유 | 워치리스트 랭킹(4.2) |
| `score_candidate(uid, film_id)` | — | 단일 후보 점수 + 설명 | 영화 페이지 "당신에게 맞는 정도" 배지 |
| `public_portfolio(username)` | — | 공개 보유분 + 시그니처 | `/u/[username]` |

`security definer` + `search_path=public`, 호출 권한은 `authenticated`(공개 RPC만 `anon` 허용). 기존 `get_my_pins` 컨벤션을 그대로 따른다.

### 3.4 데이터 의존성(선행 채움 필요)
- **국가/지역**: 별도 컬럼이 아니라 `films.tmdb_extra` JSONB의 `country`/`original_language`에 들어 있음(`0015_tmdb_enrichment`). 분포에 쓰려면 JSONB에서 끌어오거나(즉시 가능) 생성 컬럼/인덱스로 정형화. `genres`는 이미 `text[]` 컬럼.
- **정전 위상(canon)**: `film_asset`의 `CRITICAL_RECEPTION`(Sight&Sound 순위 등)을 **정수 필드로 추출**해야 후보 점수의 canon 항을 쓸 수 있다. 미추출 시 점수에서 가중치 0으로 두고 후속 채움.
- **임베딩**: takes 100% 임베딩 완료 상태(STATE 문서). taste_vector 즉시 구현 가능.

---

## 4. 수치 체계 (계량 지표) — 핵심

두 축을 **하나의 고리로 연동**한다. 4.1이 4.2의 기준이 된다.

```
[4.1 포트폴리오 분석]  →  taste_vector + 분포/공백  →  [4.2 후보 점수(WWI)]
     (본 영화 합산)          (기준)                       (볼 영화 채점)
        ▲                                                      │
        └──────────── 후보를 보면 → 보유 → 분포 갱신 ◀──────────┘
```

### 4.1 포트폴리오 분석 (본 영화 합산)

블룸버그 "팩터 노출"에 해당. 모두 `portfolio_breakdown`에서 산출.

1. **구성 분포(노출)** — 다축 비중:
   - 연대(decade), 국가/지역, 감독, **오독 렌즈(framework 14종)**, 전통(tradition), 트로프(figure_type).
   - 표시: 도넛/막대 + "상위 N + 기타".
2. **취향 시그니처** — `taste_vector` 기반 한 줄 + 가장 가까운 트로프/렌즈 3개("당신의 무의식적 선분").
3. **깊이 지표** — 평균 평점, 다시보기 비율, **내가 오독(take)을 쓴 영화 비율**(MetaTake 고유 — 단순 시청을 넘어 *개입한* 자산).
4. **편향·공백 진단(Bloomberg "underweight")** — 통계가 아니라 *권유*:
   - "유럽 예술영화 71% — 아시아 뉴웨이브 노출 4%."
   - "**정신분석 렌즈에 집중** — *존재론(ontology)* 렌즈로 본 영화 0편."
   - "1990년대 이전 0편 — 고전 정전 공백."
   - 이 공백이 4.2에서 후보의 **gap-fill 점수**로 환산된다.
5. **정전 커버리지** — 세계 정전(예: S&S 상위) 대비 내 보유 비율 게이지("당신은 BFI 250 중 38편 보유").

### 4.2 후보 "왜 봐야 하나" 점수 — WWI(Why-Watch Index)

워치리스트의 각 후보(및 임의 영화)에 **0–100 종합 점수 + 4개 서브점수 + 한 줄 사유**를 매긴다. 모두 4.1을 기준으로 계산.

| 서브점수 | 정의(데이터) | 기본 가중 |
|---|---|---|
| **Affinity(친연도)** | `cosine(taste_vector, 후보 영화 figure/take centroid)` → 0–100 정규화 | 35% |
| **Lineage(연결 강도)** | 후보와 *내 보유분* 사이 공유 figure_type·framework 수 + `film_next` 계보 링크 + 같은 감독/지역 | 30% |
| **Gap-fill(공백 충족)** | 후보가 내 sparse 축(안 본 국가/연대/렌즈/감독)을 메우는 정도 | 20% |
| **Canon(정전 위상)** | `film_asset` 수상·정전 순위(S&S 등) → 0–100 | 15% |

```
WWI = 0.35·Affinity + 0.30·Lineage + 0.20·GapFill + 0.15·Canon
```

- **연동 고리**: Affinity·Lineage·GapFill 모두 4.1 산출물(taste_vector·분포·공백)을 입력으로 쓴다. 본 영화가 바뀌면 모든 후보 점수가 자동으로 재배치된다 — 이것이 "포트폴리오 운용" 감각의 핵심.
- **설명가능성(필수)**: 점수마다 사람이 읽는 사유를 함께 반환. 예 —
  > **WWI 88 · BUY** — *친연도 상위 6%*(당신이 본 브레송·다르덴과 같은 절제된 응시). *연결*: 트로프 「무력한 목격자」 3편 공유. *공백 충족*: 당신에게 없는 *존재론* 렌즈의 정점. *정전*: S&S 2022 16위.
- **가중치 조절**: 사용자가 슬라이더로 Affinity↔Discovery 성향 조절 가능(블룸버그 팩터 틸트). 기본값은 위 표.
- **표시**: 워치리스트 테이블에서 WWI 내림차순 정렬 + 서브점수 스파크 막대. 영화 페이지에는 "당신에게 88" 배지 + 한 줄.

> 정직성 원칙: 보유분이 적으면(예: <10편) Affinity·GapFill 신뢰도가 낮다 → "포트폴리오 형성 중, Canon 위주로 추천" 라벨로 **과적합 경고**. `/ask`가 "코퍼스에 없음"을 정직히 말하는 태도와 일관.

---

## 5. 화면 설계 (블룸버그식 패널)

### 5.1 비공개 터미널 `/me` — 와이어프레임

```
┌─ HEADER ───────────────────────────────────────────────────────┐
│ wonwoo의 자산 터미널            [본 영화 ▸] [볼 영화 ▸] [설정]   │
├─ KPI 스트립 (count-up) ────────────────────────────────────────┤
│ 보유 142편 │ 워치리스트 38 │ 평균 7.8 │ 내 오독 19 │ 정전 38/250 │
├─ 좌: 포트폴리오 구성 ──────────┬─ 우: 워치리스트 TOP (점수순) ──┤
│ 도넛: 국가·연대·오독 렌즈      │ 1. Au Hasard Balthazar  WWI 88 │
│ 탭 전환 / 상위N+기타           │ 2. The Turin Horse       85    │
│ ──────────────────            │ 3. First Cow             82    │
│ 취향 시그니처 1줄 + 선분 3개   │ … 스파크 막대 + 사유 한 줄     │
├─ 편향·공백 진단 (권유 카드) ───┴────────────────────────────────┤
│ • 아시아 뉴웨이브 노출 4% — 보강 후보 3편                         │
│ • 존재론 렌즈 0편 — 이 렌즈의 정점 보기                           │
├─ 그물망 (EntityGraph, 보유분 중심) ────────────────────────────┤
│ 내가 본 영화들이 형상·트로프로 어떻게 엮이는가 (클릭→이동)        │
├─ 최근 활동 / 내가 쓴 오독 (기존 /me 흡수) ─────────────────────┤
└────────────────────────────────────────────────────────────────┘
```

패널은 모두 **실데이터 RPC** 위에. EntityGraph는 기존 컴포넌트를 보유분 시드로 재사용(신규 `graph_portfolio_seed` RPC).

### 5.2 워치리스트 `/me/watchlist`
점수순 정렬 테이블이 주인공: `[포스터][제목·연도·감독] [WWI] [Affinity│Lineage│Gap│Canon 막대] [사유] [우선순위 ▾] [본 영화로 ✓]`. 상단에 Affinity↔Discovery 슬라이더 + 정렬/필터(렌즈·국가·연대). "본 영화로" 클릭 → 같은 행 status 승격 → 포트폴리오·전 후보 점수 재계산.

### 5.3 포트폴리오 심층 `/me/portfolio`
다축 분포 풀뷰 + 정전 커버리지 게이지 + 보유작 그리드(포스터 월, 평점/렌즈/국가 필터). "이 축으로 본 영화들" 드릴다운.

### 5.4 공개 전시 `/u/[username]`
정제된 한 면: ① 취향 시그니처 헤드라인, ② 상위 보유작 6–9편 포스터, ③ 분포 요약 도넛 1–2개(렌즈·국가), ④ 공개 그물망 미니, ⑤ "공개된 본 영화 전체 ▸". 평점/메모/워치리스트/공백 진단은 숨김. 분석이 아니라 **초상**.

---

## 6. 사용자 흐름

1. **담기**: `/film/[slug]`에서 `[✓ 봤음] [+ 볼 영화]` 버튼(기존 Follow/Like 옆) → `set_film_status`. 봤음 선택 시 평점/관람일/장소 인라인 입력(선택).
2. **운용**: `/me/watchlist`에서 WWI 정렬을 보고 다음 볼 영화 결정 → 보면 "본 영화로 ✓" → 포트폴리오·점수 자동 재배치.
3. **발견 루프**: 공백 진단 카드 → 보강 후보 → 워치리스트 담기 → 시청 → 공백 축소. (블룸버그의 리밸런싱)
4. **전시**: 설정에서 공개 토글 → `/u/[username]`로 취향 초상 공유.

---

## 7. 구현 로드맵 (단계)

| Phase | 산출물 | 핵심 작업 | 의존 |
|---|---|---|---|
| **P0 — 상태 레이어** | 본/볼 담기 동작 | `user_films` 마이그레이션 + RLS + `set_film_status`/`get_my_films`; 영화 페이지 버튼 | TMDB country 백필 권장 |
| **P1 — 터미널 홈** | `/me` 승격 + 포트폴리오 패널 | `portfolio_breakdown` + KPI + 분포 차트 + 기존 핀/오독 흡수 | P0 |
| **P2 — 점수 엔진** | WWI 워치리스트 | `user_taste_profile` + `refresh_taste_profile` + `score_watchlist`/`score_candidate`; 영화 페이지 점수 배지 | P1, canon 추출 |
| **P3 — 공개 포트폴리오** | `/u/[username]` 전시 + visibility 토글 | `public_portfolio` + 공개 그리드 + 설정 토글 | P1 |
| **P4 — 그물망·고급** | 보유분 EntityGraph + 가중치 슬라이더 + 활동 로그 | `graph_portfolio_seed`, `user_film_events`, 시그니처 LLM 생성 | P2 |

각 Phase는 `deploy-*.command` 단위로 분리 배포(레포 컨벤션). 마이그레이션은 live DB drift 주의(STATE §8) — 적용 후 repo에 덤프.

---

## 8. 열린 결정 / 리스크

1. **`/me` 재설계 vs 신규 `/me/portfolio`** — 기존 `/me`를 터미널로 덮을지, 별 라우트로 둘지. (권장: `/me`를 터미널 홈으로 승격, 리스트는 패널로 흡수.)
2. **canon 위상 데이터** — `film_asset`에서 정전 순위를 정형 필드로 추출하는 작업 필요. 없으면 P2의 Canon 항 보류.
3. **국가/지역 정합** — TMDB 국가 데이터 완비 여부 확인 후 분포 정확도 결정.
4. **WWI 가중치 디폴트** — 35/30/20/15는 초안. 파일럿 보유분으로 튜닝.
5. **소규모 보유분 과적합** — <10편 구간의 점수 신뢰도 라벨링 정책.
6. **공개 기본값** — "본 영화" 사실만 공개 / 평점·메모 비공개를 기본으로(프라이버시 우선).
7. **트로프 성숙도 연계** — 후보의 트로프가 Cliché인지 Fresh인지(성숙도 = 영화 수)도 Lineage/Discovery 신호로 쓸지.

---

*다음 단계 후보: 이 기획안 확정 → P0 마이그레이션(`user_films`) 초안 작성, 또는 비공개 터미널 화면 HTML 목업으로 시각 검증.*
