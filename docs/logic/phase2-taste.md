# Phase 2 — 추천이 나를 안다: 취향 벡터 ① + 추천 위생 (taste 주입)

> **기준은 Phase 0·1과 동일.** 라이브 Supabase의 *실제 임베딩·조인 경로·함수 소스*를 열람해 그 위에 설계한다. **DB 미수정 — 모든 SQL은 "제안", 승인 후 적용.** 예측가능성(least astonishment)이 유일한 합격선. 작성 2026-06-26. 선행: `phase0-invariants.md`·`phase1-standing.md`·엔진 명세 `01-taste-vector.md`(이 문서가 실 스키마로 *교정·접지*함).

---

## 0. Phase 2가 닫는 astonishment

사용자 기대: **"이거… 어떻게 알았지? 그리고 다 안 본 거네."**

| # | 증상 (현재) | 어기는 약속 |
|---|---|---|
| **A** | `score_watchlist`가 **taste-blind**(주관 항 0) → 누구에게나 같은 논리 | "추천이 나를 안다"가 거짓 |
| **B** | 후보 = *내 watchlist뿐* → 새 영화를 권하지 못함 / 본 영화가 섞일 위험 | "추천 = 내가 안 본 것" |
| **C** | 평점을 줘도 추천이 그 방향으로 안 변함(취향 입력 없음) | "9점 줬는데 왜 무관한 게?" |

세 증상의 뿌리는 하나 — **주관 기둥(①)이 아예 없다.** Phase 1이 객관(②정전가)을 세웠으니, Phase 2는 주관을 세우고 그것을 추천에 주입한다.

---

## 1. 진단·기반 (실측)

| 사실 | 실측 |
|---|---|
| 임베딩 공간 | `figures.embedding` · `takes.embedding` · `meta_takes.embedding` 모두 **`vector(1536)`** (text-embedding-3-small, 동일 공간) |
| take→영화 조인 | **takes엔 `film_id` 없음.** 경로 = `takes.figure_id → figures.id → figures.film_id`. 73,478 takes 전부 `figure_id`·`embedding` 보유, 43,426은 `meta_take_id`도 |
| 해석 커버리지 | 임베딩 take 보유 영화 **1,941편** (영화당 take **37.9** · figure **9.4** = 조밀, thin-content 아님). 단 채점 카탈로그(~5,985)의 *나머지*는 해석 임베딩 없음 |
| 앵커 재료 | `meta_takes.kind` = **`figure_type`(트로프) · `reading`(강한 오독)** — 둘 다 *이미 임베딩됨* → 앵커 투영의 기성 centroid |
| 상태 | `user_taste_profile` **없음**(신규) · films 임베딩 **없음**(신규 머티리얼라이즈) · 라이브 포트폴리오 사실상 0(user_movies 1행) → **forming이 주 경로** |
| 추천 소스 | `score_watchlist` = `round(0.45·lineage + 0.25·gap + 0.30·canon)`, **주관 항 0**(Phase 1에서 소스 확인). `canon`은 `prestige_score` → Fix-A로 자동 정정됨 |

**정직성 한 줄:** taste 코사인은 *해석 임베딩이 있는 1,941편*에서만 성립한다. 나머지 영화에선 taste가 **abstain**하고 계보·정전이 캐리한다 — 데이터 없는 곳에서 취향을 지어내지 않는다.

---

## 2. 검증 먼저 — 기계가 말이 되는가

설계 전에 "평점 9점 → 무엇이 뜨나"를 **실 임베딩 코사인**으로 시험. 〈Vertigo〉의 해석 centroid에 가장 가까운 영화들(읽기 전용):

| 이웃 | 감독 | cos_dist |
|---|---|---|
| Psycho (1960) | Hitchcock | 0.118 |
| Mulholland Drive (2001) | Lynch | 0.124 |
| Don't Look Now (1973) | Roeg | 0.125 |
| Marnie (1964) | Hitchcock | 0.128 |
| Rebecca (1940) | Hitchcock | 0.137 |
| Shadow of a Doubt (1943) | Hitchcock | 0.138 |
| Inland Empire (2006) | Lynch | 0.139 |
| Spellbound (1945) | Hitchcock | 0.141 |
| Shutter Island (2010) | Scorsese | 0.143 |

**히치콕 + 린치적 정체성 와해 + 강박/이중성 스릴러** — 장르·감독 매칭이 아니라 *해석 시그니처*(응시·이중성·정체성 붕괴)로 묶인다. "어떻게 이걸 알았지" 품질이 실데이터에서 실증됨. (Insidious/Longlegs 같은 약한 외곽은 §7의 다양성·정전 필터가 처리.) **→ 임베딩 기반 이웃 경로 채택 확정.**

---

## 3. v_film — 영화의 해석 좌표 (실 조인)

```
interp(f) = avg(tk.embedding)
            from takes tk join figures fg on fg.id = tk.figure_id
            where fg.film_id = f and tk.embedding is not null
v_film(f) = l2_normalize(interp(f))        -- 임베딩 take ≥1 보유 영화(~1,941)
          = NULL                            -- 그 외 → taste 코사인 abstain (계보·정전 캐리)
```

**제안(PROPOSED)** 머티리얼라이즈 — 코사인의 후보 쪽:

```sql
-- 제안. pgvector avg() 집계 사용. DB 미수정.
create table public.film_taste_vector(
  film_id uuid primary key references public.films(id) on delete cascade,
  v vector(1536) not null, n_takes int not null,
  model_version text not null default 'te3s', refreshed_at timestamptz not null default now()
);
-- 적재:
insert into public.film_taste_vector(film_id, v, n_takes)
select fg.film_id, l2_normalize(avg(tk.embedding))::vector(1536), count(*)
from public.takes tk join public.figures fg on fg.id = tk.figure_id
where tk.embedding is not null and fg.film_id is not null
group by fg.film_id;
```

*(① spec의 α-하이브리드(해석×메타 혼합)는 films 메타 임베딩 소스가 생기면 v2. 현재는 해석 임베딩 유무로 이분 — 있으면 v_film, 없으면 abstain.)*

---

## 4. v_watched / v_loved — 사용자 좌표 (스케일 교정)

① spec은 `user_films.rating(1–10)`을 가정했으나 실제는 `user_movies.rating(0.5–5)` → **Phase 0 §③ 스케일로 교정**:

```
rating10(f) = user_movies.rating × 2                        -- 0.5–5 → 1–10, NEUTRAL=6
w(f)  = max(0, rating10(f) − 6) · recency(f) · boost(f)     -- 6점 이하 = 가중 0(척력은 v2)
   recency(f) = 0.5 ^ ( (current_date − watched_at) / (2.5·365) )   -- watched_at NULL → 1(중립)
   boost(f)   = 1 + 0.5·[내가 f에 take 씀: takes.author_id=uid]
                  + 0.25·[user_pins(kind='like') 저장]
v_loved   = l2_normalize( Σ_f  w(f)·v_film(f) )    over watched f, v_film NOT NULL  -- 추천·친연도
v_watched = l2_normalize( avg(v_film(f)) )         over watched f, v_film NOT NULL  -- 커버리지·공백
```

`watched`는 Phase 0 predicate(`seen OR rating IS NOT NULL`). **v_film NULL인 본 영화는 0 기여** — 해석 없는 영화는 취향 *모양*에 기여하지 못한다(정직). 두 벡터 분리 이유: `v_watched`=내가 *가본 곳*(④⑦), `v_loved`=내가 *가고 싶은 곳*(⑤⑥).

---

## 5. 앵커 · 시그니처 · 신뢰도 (실 테이블)

벡터는 블랙박스 → 항상 *이름*으로 투영(설명가능성, 출시 필수):

```
anchors = top-N  meta_takes mt  (kind in ('figure_type','reading'), embedding NOT NULL)
          by sim = 1 − (mt.embedding <=> v_loved)
→ "당신의 코드: 「무력한 목격자」 「전이된 죄」" + 시그니처 문장
(이론가 앵커: theory_canon.embedding 동일 방식, 선택)

N_loved       = count( watched f : rating10(f) ≥ 7 and v_film(f) NOT NULL )
taste_forming = (N_loved < 8)       -- ※ Phase 0/3의 *포트폴리오* forming(watched<8)과 다른 게이트 — 이건 취향 신뢰 게이트
conf          = sigmoid( a·N_loved + b·interp_coverage − c )
```

**콜드스타트가 주 경로**(라이브 1유저·1영화): `taste_forming=true`면 추천은 정전·인기 폴백(Phase 1), UI "형성 중", taste 항 미사용. `v_loved`가 정의 불가(loved 0편)면 **taste = NULL**(NaN 금지). *어휘 주의: 포트폴리오 `forming`(Phase 0 `me_summary`, watched<8)과 `taste_forming`(loved<8)은 별개 — 많이 봤지만 평점은 적은 사용자는 전자는 졸업·후자는 형성 중일 수 있다.*

---

## 6. 저장 (PROPOSED)

```sql
-- 제안. DB 미수정.
create table public.user_taste_profile(
  user_id uuid primary key references auth.users(id) on delete cascade,
  v_watched vector(1536), v_loved vector(1536),
  anchors jsonb not null default '[]', clusters jsonb not null default '[]',
  n_loved int not null default 0, confidence numeric, taste_forming bool not null default true,
  model_version text not null default 'te3s', refreshed_at timestamptz not null default now()
);
-- RLS: 본인만 read/write. 갱신: 본 영화/평점 변경 → dirty → TTL(15분)·트리거 재계산.
-- clusters: 사랑한 영화 k-means(k=2–3) 중심 — "당신의 두 얼굴"(① §4-d, 표시용 v2).
```

---

## 7. 추천에 taste 주입 — taste-blind 해소 + 위생

### (a) 점수 — `score_watchlist` v2 (taste 항 추가)

```
taste(c) = case when utp.v_loved is not null and fv.v is not null
                then greatest(0, round(100 · (1 − (fv.v <=> utp.v_loved))))   -- 코사인→0..100
                else null end
wwi = case
        when utp.taste_forming or taste is null
          then round(0.45·lineage + 0.25·gap + 0.30·canon)                    -- Phase-1 폴백(콜드스타트·무벡터)
        else round(0.40·taste + 0.25·lineage + 0.15·gap + 0.20·canon)         -- taste 주도
      end
```

`canon = prestige_score`는 Phase 1 Fix-A로 이미 정정 → blend 정합. 가중(0.40…)은 캘리브레이션 노브(형태만 고정). **`gap` 항은 현 `score_watchlist`의 거친 휴리스틱(신규 국가/연대/감독) 대신 Phase 3의 원리적 산출 `delta_index(film)`·`my_blind_spots()`(멤버십 기하 기반 한계기여)을 소비하도록 교체** — 같은 "공백 충족"을 코퍼스 기하로 일관되게 잰다. Δindex는 동시에 카드에 "→ NAV +N" 자산 논거로 노출(Phase 3 §3 계약).

### (b) 후보 확대 — 추천이 watchlist에 갇히지 않게 (B 위생)

현 `score_watchlist` 후보 = 내 watchlist뿐. 추천은 *안 본 새 영화*여야 함. **제안 `recommend()`**: 후보 = ⋃(사랑한 영화의 `film_affinities` 이웃 `related_film_id`) **∖ watched ∖ watchlist**, `film_id` dedup. `film_affinities`(38,800행, `score`·`shared_meta_take_ids`·`lineage_score`) = **엔진⑥ 기성 그래프** — §2의 임베딩 이웃과 같은 직관을 이미 적재된 형태로 제공.

### (c) 다양성·이유·위생

- **다양성:** top10에 같은 `films.director` ≤2 (또는 MMR). "브레송만 5개" 피로 방지.
- **이유(6+가용 정본 — 여러 Phase 산출을 매핑, 00-INDEX §4):** 후보의 *최상위 기여* 이유 하나를 색과 함께 표시. 모든 후보 ≥1 이유, 0이면 노출 안 함(이유 정렬 = 기여 정렬, 계약 J).

  | 이유 | 색 | 출처(엔진/Phase) | 발화 |
  |---|---|---|---|
  | `safe` 안전자산 | teal | **taste 코사인**(① Phase 2) | taste 최상위 — "당신 취향에 of-course" + 가장 가까운 사랑한 이웃/앵커 |
  | `frontier` 안전한 모험 | blue | **`discovery_score`**(Phase 1 Fix-B) | taste 맞으면서 discovery 높음 — 덜 알려진 인접작 |
  | `canon` 정전 위상 | gold | **`prestige_score`**(Phase 1 Fix-A) | 정전가 높음 |
  | `gap` 공백 충족 | amber | **`my_blind_spots()`·`delta_index`**(Phase 3) | 내 블라인드 라인을 메움(§7(a) gap) |
  | `conquer` 도장깨기 | red | **`delta_index`·완파 근접**(Phase 3·4) | 한 라인 완파를 코앞에서 끝냄 |
  | `reading` | violet | **`takes.framework`·`reading` 앵커**(Phase 2 §5) | 후보가 내 reading 성향과 합치 |
  | (`avail` 가용) | green | **`film_availability()`**(Phase 0 ⑧) | *이유 아님 — 필터/가산*(지금 볼 수 있음) |
- **위생 불변식(Phase 0 상속):** 후보 = `NOT watched`(단일 predicate) → 본·평점 영화 0건; watchlist dedup; 안정 정렬 `wwi desc, film_id`.

### (f) Cinecodex(⑨) 소비 — 품질·위험 (비섞임 단방향 · `09-intrinsic-cinecodex.md`)
객관 품질·위험은 ①취향(fit)·②정전가(인정)와 별개로 **엔진 ⑨에서 출력만 소비**한다(역류 금지):
- **품질 prior = V**(Cinecodex 획득가치) — 콜드스타트 시 정전가 시간편향 보완. ※ **U 아님** — U는 R 차감분이라 R 필터와 *이중계산*.
- **위험 필터 = R** → `risk_mult = clamp(1 − ρ·R, floor, 1)`로 WWI에 **곱셈**(합산 아님 — 비섞임 보존). 고위험작 자동 강등, floor로 안 죽임. 위험은 7번째 이유가 아니라 **경고 배지**(S11).
- **U = 후보 풀 품질 게이트**(만인 공통 바닥) + 콜드스타트 폴백.
- **λ = 사용자 위험회피 다이얼**(보수↔모험, 선호 다이얼).
- **단방향:** NAV/WWI/정전가/외부지표를 Cinecodex *입력*으로 되돌리지 않는다.

---

## 8. 수용 테스트 (예측가능성 — Contract B·C)

- **of-course-fit:** Vertigo 애호가 top = 히치콕/강박·이중성 계열(§2 실증).
- **위생:** 본 영화·담은 영화가 추천에 **0건**(NOT watched predicate).
- **이유:** 모든 카드에 납득되는 한 줄, 근거 없는 카드 0.
- **반응:** 어떤 영화 9점 직후 → 취향 dirty → 재계산 → 그 이웃이 부상(`w(f)` 점프).
- **콜드스타트:** `taste_forming` 또는 무벡터 유저 → 정전 폴백, taste=null 경로, **NaN 0건**.
- **다양성:** top10에 한 감독 ≤2.

---

## 9. 적용 순서 · 닫는 것 · 다음

**적용(제안 — 승인 후):** ① `film_taste_vector` 적재(1,941편) → ② `user_taste_profile` + 빌더 RPC → ③ `score_watchlist` v2(taste 주입) + `recommend()`(후보 확대·다양성) → ④ 회귀(§2 이웃 일관성 재현 + 위생 0건 + forming NaN 0). **의존:** Phase 1 Fix-A(정전가) 선적용 — `canon` 항이 옳아야 blend 정합.

**닫음:** of-course-fit(주관 ① 가동) · 추천 위생(안 본 것·dedup·이유·다양성) · 평점→추천 반응.

**다음 Phase 3**(NAV·Δindex·공백 — 병렬 에이전트가 `phase3-growth.md`로 이미 설계): `v_watched` 앵커 분포가 ④ 공백의 *taste-weighted under-index*(생산적 공백)를 먹는다. ①의 인터페이스 `{v_watched, v_loved, anchors, forming}`을 그대로 소비.

DB는 이 문서 작성 시점까지 **미수정** — 모든 SQL은 제안.

---

## 10. UX 역반영 (2026-06 직관화 패스 · `docs/ux/SHARED-STANDARD.md`)

직관화에서 도출된 백엔드 요구를 ⑤/추천에 못박는다(지금은 비주얼만, 아래는 다음 백엔드 단계):
- **`rate_film(film, 0.5–5)`** — 평점 입력 → `watched` 자동(Phase 0 ①) + 가치뱃지·NAV 즉시 재계산(optimistic). 인라인 별점 컴포넌트의 영속.
- **`add_watchlist(film)`** = "담기"(워치리스트 추가, *제자리·페이지 이동 없음*) · **`mark_watched(film)`** = "봤어요"(보유 이동) · **`dismiss_candidate(film)`** = "관심없음"(부정 신호 → `recommend()` 후보에서 제외 + 약한 척력으로 taste/affinity 반영).
- **명칭**: Δindex 최상위 후보 = **「오늘의 한 편」**(전 추천 표면 통일).
- 위 액션은 `taste_forming`에서도 NaN 0·동작 일관.

---

*Phase 2 = 주관 기둥(①취향)을 세우고 추천에 주입하는 단계. ②객관(Phase 1)×①주관(Phase 2)이 모든 상위 엔진의 두 입력.*
