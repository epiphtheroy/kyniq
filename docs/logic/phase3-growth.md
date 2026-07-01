# Phase 3 — 내가 성장한다: NAV·레벨(⑧) · Δindex(다음 한 편의 값) · 공백/블라인드(④)

> **기준은 Phase 0·1과 동일.** 추측이 아니라 라이브 Supabase(`jvgarcqrtsmgfimdcwgo`)의 *실제 컬럼·행*을 읽고 그 위에 설계한다. **DB는 수정하지 않는다 — 모든 SQL은 "제안(PROPOSED)"이며 승인 후에만 적용.** 예측가능성(least astonishment)이 유일한 합격 기준. 작성 2026-06-26. 폴더: `/Users/jerryje/Documents/MetaTake/docs/logic/`. 선행: `phase0-invariants.md` · `phase1-standing.md`. 상속: 직관 계약 **C(단조·방향)** · **D(콜드스타트·빈 상태)**. 엔진 명세: `08-nav-level.md`(⑧) · `04-gap.md`(④) · `01-taste-vector.md`(① — *출력 인터페이스만 소비*).

---

## 0. Phase 3이 닫는 astonishment

Phase 1이 *"내 것이 정확하다"*(정전가)를 세웠다. Phase 3은 그 위에 *"내가 성장한다"* 를 얹는다 — 진척이 정직해야 한다. 네 가지 배신이 표적이다.

| # | 증상 (성장 화면이 거꾸로 도는 곳) | 사용자가 느끼는 배신 | 닫는 엔진 |
|---|---|---|---|
| **A** | 한 편 더 봤는데 NAV·레벨이 *내려감* | "봤는데 자산이 깎인다" (계약 C) | ⑧ 단조 보장 |
| **B** | "다음 한 편 +N"이 *이미 가진 영역의 고권위작*에서 가장 큼 | "라틴 0편인데 또 칸 명작을 권한다" | Δindex novelty |
| **C** | 라틴 0편인데 라틴이 블라인드로 *안 뜸* | "안 본 곳이 안 본 곳으로 안 보인다" (계약 D) | ④ 절대 결핍 |
| **D** | 0편 유저 헤더에 `NAV NaN` / 빈 레벨 | "처음부터 깨져 있다" (계약 D) | ⑧ 콜드스타트 `forming` |

네 증상의 공통 뿌리: **NAV가 "편수 카운터"가 되거나(부피 보상→A·B), 빈 상태를 안 지키면(NaN→D), 성장 서사 전체가 거짓말이 된다.** 아래는 실데이터로 그 뿌리를 짚고 막는 설계다.

---

## 1. 진단 — 실측이 강제한 두 사실

라이브를 읽어 Phase 3 설계를 *제약*하는 두 사실을 먼저 박는다.

### 사실 ① 라이브엔 포트폴리오가 사실상 없다 → NAV는 *콜드스타트가 기본*

```
user_movies: 1행 · distinct_user 1명 · 그 1행도 watched_at NULL (rating 3.5, seen=true)
```

**함의:** NAV 엔진의 *가장 흔한 입력은 빈/소량 포트폴리오*다. 따라서 콜드스타트(계약 D)는 예외가 아니라 **주 경로**다. `forming`·`null`·anti-NaN 가드가 *장식이 아니라 척추*. (검증은 §5.)

### 사실 ② Phase 1 Fix-A는 *아직 미적용* → 라이브 정전가는 v1(저평가) 상태

실측:

| 영화 | 라이브 `prestige_score` | `model_version` | `discovery_score` |
|---|---|---|---|
| Parasite (2019) | 93.8 | v1 | 0.0 |
| The Godfather (1972) | 84.7 | v1 | 0.0 |
| Citizen Kane (1941) | 68.4 | v1 | 0.0 |
| Vertigo (1958) | 40.3 | v1 | 0.0 |
| Tokyo Story (1953) | 41.2 | v1 | 0.0 |
| Stalker (1979) | 34.0 | v1 | 0.0 |

→ NAV의 ② 입력(`film_scores.prestige_score`)은 **Phase 1 적용 후**라야 신뢰. NAV의 정전권위 축은 *prestige를 그대로 소비*하므로, **NAV 절대 캘리브레이션은 Fix-A 적용을 전제**한다(미적용 상태에서 NAV를 박으면 옛 명작 보유가 저평가됨 — Phase 1 §5의 가치뱃지 결함이 NAV로 전파). 본 문서의 절대 NAV 숫자는 *Fix-A 후 prestige*(Phase 1 §2 검증표: Vertigo 84.2 등) 기준으로 쓰고, *커버리지·Δindex 델타는 Fix-A와 무관한 멤버십 기하*라 라이브 그대로 시뮬한다.

### 진단 결론 — Phase 3의 두 가드레일

1. **단조(C):** NAV의 큰 부분은 *커버리지 교집합 카운트*와 *정렬 감쇠 합* — 둘 다 영화를 더하면 비감소. 명시적 저평점만 P&L에 drawdown을 만들되 *NAV 절대값은 안 깎는다*.
2. **빈 상태(D):** 모든 집계는 `count=0 → null`, `SUM over ∅ → 0`(NaN 아님)으로 가드. 라이브가 0편이 기본이므로 *이 가드가 가장 먼저 맞아야 한다*.

---

## 2. 엔진 ⑧ — NAV / 레벨 (포트폴리오 총량 + 밴드)

`08-nav-level.md`의 4축 구조를 *Phase 1·실컬럼*으로 못박는다. NAV는 헤더 유일 숫자(`NAV 1,284 · LV. Established · 상위 14%`), 부피 보상 금지.

### 2.1 4축 — 실컬럼 매핑

| 축 | 정의 (실컬럼) | 부피 면역 장치 |
|---|---|---|
| **breadth (폭)** | ⑦ `my_lineage_coverage()` 의 `watched`를 라인 `authority_weight`로 가중합 | 라인당 *1회만* 채워짐 → 같은 영화 반복은 0 기여 |
| **prestige (권위)** | 본 영화의 `film_scores.prestige_score`(Fix-A 후) **정렬 내림차순 기하감쇠 합** | `δ_nav` 감쇠 → N번째 보유작 기여 체감 |
| **depth (깊이)** | `user_movies.rating` 분포 위치 + (장차 `takes`/다시보기) | 평점 *분포 상대*(절대 평점 아님) → 인플레 방어 |
| **disc (발굴)** | 본 영화의 `film_scores.discovery_score`(Phase 1 Fix-B) 감쇠 합 | prestige×희소라 무명+저정전은 자동 0 |

> **단일 계보 우주(Phase 0 ⑩):** breadth·blindspot의 라인 모집단·라인별 `watched`는 **Phase 1 `my_lineage_coverage()`와 동일 술어**(`status='active' AND film_count>0`)·동일 분자여야 한다. §2.6 SQL은 데모용 인라인이나, 구현 시 `my_lineage_coverage()`(이제 `list_id` 반환)를 단일 소스로 경유 권장. facet 범위도 정전가와 동일(`movement·style` 제외).

> **Phase 3 범위 한정:** `takes`/다시보기 컬럼은 본 스키마 실측엔 없다(`user_movies`엔 `note`만). 따라서 **depth는 1차안에서 `rating` 분포항만** 사용하고, take·rewatch 가산은 *훅만 남기고 0*(해당 테이블 적재는 별도 Phase). 이로써 "없는 컬럼에 기대는 숨은 로직"을 만들지 않는다(계약: 예측가능성).

### 2.2 NAV 공식 (제안 — 형태 고정, 상수는 가설)

`NEUTRAL=6`(Phase 0 §③, ★3 = rating10 6)을 상속. `rating10 = rating*2`.

```
-- 축별 입력 (사용자 u, 본 영화 집합 F = Phase0 watched predicate)
breadth(u) = Σ_{ll touched}  authority_weight(ll) · watched_in(ll)        -- ⑦ × 권위 가중
prestige(u)= Σ_{k}  prestige_score(f_k) · δ_nav^(k-1)                     -- f를 prestige 내림차순 정렬, k=1..
depth(u)   = Σ_{f∈F}  max(0, rating10(f) − NEUTRAL) / 4                   -- ★3 초과분만, 0–1 정규 (rating∈[0.5,5] → rating10∈[1,10])
disc(u)    = Σ_{k}  discovery_score(g_k) · δ_nav^(k-1)                    -- discovery 내림차순 정렬

NAV(u) = round( 100 · ( w_b·breadth + w_p·prestige + w_d·depth + w_v·disc ) / C )
  가설: w_b=0.35 · w_p=0.35 · w_d=0.20 · w_v=0.10 · δ_nav=0.85 · C=캘리브레이션 노브
```

**감쇠 정렬은 Phase 0 §⑤ 결정적 정렬을 상속:** prestige·disc 축의 정렬 tie-break은 `prestige_score DESC, film_id`(동점 영화의 k 순서가 흔들리지 않게). 재계산 reshuffle 0.

### 2.3 ★ 단조 보장 (the astonishment guard — 계약 C)

**정리(단조):** 임의의 영화 `f`를 본 영화 집합 `F`에 더하면 `NAV(F ∪ {f}) ≥ NAV(F)`. 평점·관람 여부와 무관.

증명 스케치(각 축이 비감소임을 보임):
- `breadth`: `watched_in(ll)`은 *교집합 카운트* → 새 영화가 새 라인을 채우면 +, 안 채우면 +0. **감소 불가.**
- `prestige`·`disc`: `prestige_score, discovery_score ≥ 0`이고 감쇠 가중 `δ_nav^(k-1) > 0`. 항을 *추가*하면 합은 비감소(정렬이 바뀌어도 항 집합이 superset이라 합 ≥). **감소 불가.**
- `depth`: `max(0, rating10−NEUTRAL) ≥ 0`. **★3 이하(저평점)는 0 기여 — 깎지 않음.** 평점이 없으면 0 기여. **감소 불가.**

→ **"관람은 항상 ≥0 기여. 저평점은 0이지 음수가 아니다."** 명시적 저평점의 *후회*는 P&L `regret`(별도 렌즈)에만 음수로 나타나고 **NAV 절대값은 안 깎는다**(자산은 매도 안 함). 이것이 계약 C의 "그냥 봤는데 자산 하락" 금지를 구조로 박는다.

### 2.4 레벨 밴드 — 절대 컷 금지, 코퍼스 백분위 (인플레 면역)

```
percentile(u) = NAV(u)의 *사용자 코퍼스* 백분위
level = band(percentile):
  Novice ≤40% · Emerging 40–70% · Established 70–90% · Connoisseur 90–98% · Master ≥98%
header = "NAV {nav} · LV. {level} · 상위 {100−percentile}%"
```

**라이브 주의(실측 사실 ①):** 현재 사용자 코퍼스 = 1명. 백분위 밴드는 *노이즈*다. → **사용자 N이 임계(가설 ≥ ~30명) 미만이면 레벨/백분위 미표시**, 헤더는 NAV 숫자 + "형성 중(코퍼스)" 만. 절대 NAV 컷으로 밴드를 박지 않는다(인플레·거짓 변별 방지).

### 2.5 콜드스타트 (계약 D — 라이브의 *주* 경로)

```
forming(u) = (#watched < 8)                       -- Phase 0 me_summary.forming 재사용
콜드스타트면:  NAV = null, level = null, header = "형성 중 ({N}편)"
              depth/disc 축 0, Δindex는 *오히려 강조*(거의 모두 공백 → 큰 +N = 형성 가속)
NaN 가드:     모든 SUM은 over ∅ → 0,  AVG/백분위는 count=0 → null (NaN 절대 금지)
```

### 2.6 제안 SQL — `compute_portfolio_nav(p_uid)` (PROPOSED · 미적용)

```sql
-- 제안(PROPOSED). 승인 후 적용. DB 현행 미수정. Phase0 watched predicate·Phase1 prestige(Fix-A 후) 상속.
create or replace function public.compute_portfolio_nav(p_uid uuid default auth.uid())
returns jsonb language sql stable security definer set search_path = public as $function$
  with mine as (    -- Phase 0 ① watched predicate (단일 소스)
    select um.film_id, um.rating
    from public.user_movies um
    where um.user_id = p_uid
      and (um.seen is true or um.rating is not null)
  ),
  n as (select count(*)::int as watched_n from mine),
  -- breadth: ⑦ 커버리지 × 라인 권위 (라인당 1회 → 부피 면역, 단조)
  breadth as (
    select coalesce(sum(ll.authority_weight * cnt.w), 0) as b
    from (select fl.list_id, count(distinct fl.film_id) as w
          from public.film_lineage fl
          where fl.film_id in (select film_id from mine)
          group by fl.list_id) cnt
    join public.lineage_lists ll on ll.id = cnt.list_id
      and ll.status = 'active' and ll.film_count > 0
  ),
  -- prestige: 보유작 정전가 정렬 감쇠 합 (Phase0 §⑤ tie-break film_id, 단조)
  prestige as (
    select coalesce(sum(fs.prestige_score
             * power(0.85, row_number() over (order by fs.prestige_score desc, m.film_id) - 1)), 0) as p
    from mine m join public.film_scores fs on fs.film_id = m.film_id and fs.track = 'all'
  ),
  -- depth: ★3 초과분만 (저평점은 0, 단조·인플레 방어). rating∈[0.5,5] → rating10∈[1,10], NEUTRAL=6
  depth as (
    select coalesce(sum(greatest(0, m.rating*2 - 6) / 4.0), 0) as d from mine m
  ),
  -- disc: 발굴 정렬 감쇠 합 (Phase1 Fix-B discovery_score)
  disc as (
    select coalesce(sum(fs.discovery_score
             * power(0.85, row_number() over (order by fs.discovery_score desc, m.film_id) - 1)), 0) as v
    from mine m join public.film_scores fs on fs.film_id = m.film_id and fs.track = 'all'
  )
  select case when (select watched_n from n) < 8
    then jsonb_build_object('nav', null, 'level', null, 'forming', true,
                            'watched', (select watched_n from n))   -- 콜드스타트: NaN 금지, null
    else jsonb_build_object(
      'nav',     round(100 * (0.35*(select b from breadth) + 0.35*(select p from prestige)
                            + 0.20*(select d from depth)   + 0.10*(select v from disc)) / 2.42),
      'forming', false,
      'watched', (select watched_n from n),
      'nav_components', jsonb_build_object(                          -- 설명가능성(필수)
        'breadth',  round(0.35*100*(select b from breadth)/2.42),
        'prestige', round(0.35*100*(select p from prestige)/2.42),
        'depth',    round(0.20*100*(select d from depth)/2.42),
        'disc',     round(0.10*100*(select v from disc)/2.42))
    ) end;
$function$;
revoke all on function public.compute_portfolio_nav(uuid) from public;
grant execute on function public.compute_portfolio_nav(uuid) to authenticated;
```

> `C=2.42`는 Phase 1 정전 정규화 상수를 NAV 출발점으로 차용(가설). 실 사용자 코퍼스가 쌓이면 *상위≈4자리·중앙≈3자리*가 되도록 백분위 재캘리브레이션(§6).

### 2.7 검증 시뮬레이션 (읽기 전용 · 합성 8편 바스켓 · 실데이터)

라이브 포트폴리오가 1편뿐이라(사실 ①), **8편의 실재 정전 바스켓**을 합성 포트폴리오로 놓고 *실 `film_lineage` 멤버십·실 `authority_weight`·실 `film_count`*로 시뮬했다. (정전가 축의 절대값은 Fix-A 후 prestige를 써야 하므로, 여기 검증은 *Fix-A와 무관한* breadth 축에 집중 — 멤버십 기하만 쓴다.)

바스켓: Parasite · Godfather · Persona · Seven Samurai · In the Mood for Love · Tokyo Story · Vertigo · Stalker.

**facet별 커버리지(실측):**

| facet | lists_touched | 바스켓 편수 ∈ facet |
|---|---|---|
| canon | 13 | 8 |
| award | 16 | 5 |
| national | 10 | 5 |
| auteur | 1 | 1 |

**라인별 breadth 기여(상위, 실측 — `watched × authority_weight`):**

| 라인 | aw | total | watched | pct |
|---|---|---|---|---|
| Sight & Sound Critics' Poll | 0.98 | 100 | 8 | 8.0% |
| Sight & Sound Directors' Poll | 0.95 | 104 | 8 | 7.7% |
| TSPDT 1000 | 0.92 | 994 | 8 | 0.8% |
| BBC 100 Foreign-Language | 0.72 | 100 | 5 | 5.0% |
| Cahiers 100 | 0.74 | 100 | 4 | 4.0% |
| AFI 100 | 0.80 | 100 | 3 | 3.0% |

→ breadth 축이 *서구·정전 라인에 8/8 집중*. 이 집중이 §4 블라인드(라틴 0편)의 거울상이다. **단조 확인:** 모든 `watched`는 교집합 카운트라, 바스켓에 한 편을 더해도 어떤 라인의 `watched`도 감소 불가(§2.3 증명의 실증).

---

## 3. Δindex — 다음 한 편의 값 ("이 한 편 +N")

NAV 엔진이 *바깥으로 내보내는 가장 중요한 값*(⑤ WWI가 "왜 봐야 하나"의 자산 논거로 소비). 정의는 한계기여:

```
Δindex(u, f) = NAV(F ∪ {f}) − NAV(F)
```

### 3.1 근사식 (국소 미분 — 매 후보 전체 재계산 회피)

```
Δindex(u,f) ≈ round( 100/C · [ w_b·Δbreadth(u,f) + w_p·prestige_score(f)·novelty(u,f)
                             + w_v·discovery_score(f)·novelty(u,f) ] )
  Δbreadth(u,f) = Σ_{ll ∋ f, watched_in(ll)=0}  authority_weight(ll)   -- f가 *새로 여는* 라인의 권위합
  novelty(u,f)  = 1 − (이미 보유한 동일 라인 비중)                       -- 겹칠수록 0에 수렴
  (depth 항은 사후 실현 — 아직 안 봤으므로 0)
```

**핵심 의도(계약 C·④):** `Δbreadth`는 **이미 채운 라인은 0** → 같은 영역의 N번째 영화는 한계기여가 작다(체감 효용 감소가 구조에 박힘). 그래서 **공백을 메우는 영화에서 +N이 가장 크고, 포화 영역의 고권위작에서 작다.** 이것이 증상 B(라틴 0편인데 또 칸 명작 권유)를 막는다.

### 3.2 제안 SQL — `delta_index(p_uid, p_film_id)` (PROPOSED · 미적용)

```sql
-- 제안(PROPOSED). Δbreadth 항 = f가 여는, 사용자가 아직 0인 라인의 authority 합.
create or replace function public.delta_index(p_uid uuid, p_film_id uuid)
returns jsonb language sql stable security definer set search_path = public as $function$
  with mine as (
    select um.film_id from public.user_movies um
    where um.user_id = p_uid and (um.seen is true or um.rating is not null)
  ),
  basket_lists as (    -- 사용자가 이미 ≥1 채운 라인
    select distinct fl.list_id from public.film_lineage fl
    where fl.film_id in (select film_id from mine)
  ),
  cand_lists as (      -- 후보가 속한, 적재된 라인
    select ll.id, ll.authority_weight as aw, (bl.list_id is null) as is_new
    from public.film_lineage fl
    join public.lineage_lists ll on ll.id = fl.list_id and ll.status='active' and ll.film_count>0
    left join basket_lists bl on bl.list_id = ll.id
    where fl.film_id = p_film_id
  ),
  agg as (
    select coalesce(sum(aw) filter (where is_new), 0) as delta_breadth_aw,
           count(*) filter (where is_new) as new_lists,
           count(*) as total_lists
    from cand_lists
  )
  select jsonb_build_object(
    'delta_breadth_aw', round((select delta_breadth_aw from agg), 3),
    'new_lists',        (select new_lists from agg),
    'novelty',          round((select new_lists from agg)::numeric / nullif((select total_lists from agg),0), 3),
    -- 표시용 +N: breadth 항만의 한계기여(prestige·disc 항은 NAV 계수와 함께 합산; 여기선 breadth 데모)
    'delta_index_breadth', round(100/2.42 * 0.35 * (select delta_breadth_aw from agg))
  );
$function$;
```

### 3.3 ★ 검증 — gap-filler vs saturated (실데이터, 결정적)

§2.7 바스켓에 대해 두 후보의 `Δbreadth`(새로 여는 라인의 authority 합)를 실측:

| 후보 | 라이브 prestige | 속한 라인 수 | **새로 여는 라인** | **Δbreadth(aw)** |
|---|---|---|---|---|
| **Central Station** (1998, BR) — *gap-filler* | 63.7 | 3 | **3** | **2.500** |
| **Citizen Kane** (1941, US) — *saturated* | 68.4 | 13 | 3 | **2.080** |

**해석(astonishment 정확히 닫힘):** Citizen Kane은 *더 높은 prestige(68.4)*에 *13개 라인*에 속하지만, 그 13개 중 **10개가 바스켓이 이미 포화시킨 심층 정전 라인**(S&S 0.98·0.95, TSPDT 0.92, AFI 0.80 등 — `is_new=false`). Kane이 *새로 여는* 라인은 잔여 저권위 비평가상 3개뿐(1001 Movies 0.74, NYFCC 0.72, NBR 0.62) → Δbreadth **2.080**. 반면 Central Station은 *더 낮은 prestige(63.7)·단 3개 라인*이지만 **그 3개가 전부 비어 있던 라틴 라인**(Abraccine 100 등) → Δbreadth **2.500**.

> **결론: 2.500 > 2.080.** 더 낮은 정전가의 *공백 메우는* 영화가, 더 높은 정전가의 *이미 가진 영역* 영화보다 Δindex가 크다. 수용 테스트 2 통과 — **실데이터로.** 게이밍 방어(무차별·포화 시청 → 한계기여 0 수렴)가 멤버십 기하만으로 성립함을 확인.

---

## 4. 공백 / 블라인드 (엔진 ④)

`04-gap.md`를 Phase 3 범위로 한정: **절대 결핍(A)은 ②⑦만으로 계산 가능** → Phase 3에서 못박는다. **상대 under-index(B)와 생산성 게이트는 ①(취향 벡터)의 인터페이스를 소비** → *재설계하지 않고 계약으로 참조*(Phase 2 산출).

### 4.1 절대 결핍 (Phase 3 범위 — ②⑦만)

```
coverage_world(j) = watched_in(j) / film_count(j)        -- ⑦ 분자 / lineage_lists.film_count 분모
deficit_abs(j)    = 1 − coverage_world(j)
판정:  coverage_world(j)=0 → "첫 진입(blind)" · <τ(가설 0.12) → "보강"
기회점수(절대):  opportunity_abs(j) = authority_weight(j) × deficit_abs(j)
  → blind_spots[] = opportunity_abs 내림차순 (권위 있는 미답을 위로; 잡다한 미시청 억제)
```

### 4.2 ① 인터페이스 소비 (재설계 금지 — 참조만)

`01-taste-vector.md`의 계약 산출물 `{v_watched, anchors[], confidence}` 만 소비한다:

```
productivity(j) = clip( cos(v_watched, anchor(j)), 0.35, 1 )         -- ① v_watched 소비 (생산적 공백)
underindex(j)   = normalize( max(0, expected_share − my_share(j)) )  -- ① dist_* 소비 (상대 편식)
opportunity(j)  = opportunity_abs(j) × productivity(j)               -- 생산성으로 재가중
콜드스타트(① confidence 낮음 또는 #watched<12): productivity·underindex 끔(w_rel→0), 절대 결핍만 Top-N
```

> **경계 명시:** Phase 3은 `productivity`·`underindex`의 *입력 슬롯만* 정의한다. `v_watched`·`anchor(j)`·`dist_*` 의 *생성*은 Phase 2(①)의 책임. ① 미완성 구간엔 `productivity=1`(중립)로 두어 **절대 결핍 랭킹은 ① 없이도 동작**(graceful degrade, NaN·빈 화면 0건).

### 4.3 제안 SQL — `my_blind_spots()` (PROPOSED · 절대 결핍 부분만, ② 미의존)

```sql
-- 제안(PROPOSED). 절대 결핍 블라인드 — ⑦ 커버리지 + ② authority만. ① 인터페이스는 productivity로 후결합.
create or replace function public.my_blind_spots(p_uid uuid default auth.uid(), p_limit int default 20)
returns table(facet text, slug text, label text, country text, authority numeric,
              world_size int, watched int, coverage_pct numeric, opportunity numeric, blind_label text)
language sql stable security definer set search_path = public as $function$
  with mine as (
    select um.film_id from public.user_movies um
    where um.user_id = p_uid and (um.seen is true or um.rating is not null)
  ),
  cov as (
    select ll.facet, ll.slug, ll.label, ll.country, ll.authority_weight as aw, ll.film_count as total,
           count(*) filter (where fl.film_id in (select film_id from mine)) as watched
    from public.lineage_lists ll
    join public.film_lineage fl on fl.list_id = ll.id
    where ll.status = 'active' and ll.film_count > 0
    group by ll.facet, ll.slug, ll.label, ll.country, ll.authority_weight, ll.film_count
  )
  select facet, slug, label, country, aw as authority, total as world_size, watched,
         round(100.0 * watched / nullif(total,0), 1) as coverage_pct,
         round( coalesce(aw,0) * (1 - watched::numeric/nullif(total,0)), 3) as opportunity,  -- 권위 × 미답
         case when watched = 0 then '첫 진입' when watched::numeric/total < 0.12 then '보강'
              else '확립' end as blind_label
  from cov
  order by opportunity desc, aw desc nulls last, slug   -- Phase0 §⑤ 안정 정렬 (slug tie-break)
  limit p_limit;
$function$;
```

### 4.4 ★ 검증 — "라틴 0편 → 라틴 블라인드" (실데이터)

§2.7 바스켓(서구·정전 8/8 집중)에 대해 `national` facet의 0-커버리지 라인을 실측:

| 라인 | country | aw | world_size | watched | label |
|---|---|---|---|---|---|
| Abraccine: 100 melhores filmes brasileiros | br | 0.78 | 100 | **0** | **첫 진입** |
| Somos: 100 mejores del cine mexicano | mx | 0.76 | 100 | **0** | **첫 진입** |
| Museo del Cine — Encuesta de Cine Argentino | ar | 0.78 | 29 | **0** | **첫 진입** |
| Caimán: 100 mejores del cine español | es | 0.80 | 101 | **0** | **첫 진입** |
| César Best Film | fr | 0.85 | 51 | **0** | **첫 진입** |

> **결론:** 라틴(브라질·멕시코·아르헨티나) 국가 정전이 *각 0/100·0/29*로 `opportunity ≈ aw(0.76–0.78)`를 받아 블라인드 랭킹 상단에 뜬다. `coverage_world=0 → "첫 진입"` 라벨. **수용 테스트 3 통과 — 0 watched 영역이 블라인드로 표면화.** 그리고 §3.3에서 그 빈 라인을 메우는 Central Station의 Δindex가 포화작보다 컸다 → **블라인드(④)와 Δindex(⑧)가 같은 멤버십 기하 위에서 정합.**

---

## 5. 콜드스타트 검증 — 0편 유저, NaN 0건 (계약 D · 라이브 주 경로)

라이브가 0~1편이 기본(사실 ①)이라 *가장 먼저 맞아야* 하는 경로. 빈 집합 위 집계를 실측:

```sql
-- 0-film 유저 시뮬: NAV null, forming true, SUM over ∅ = 0 (NaN 아님)
WITH mine AS (SELECT NULL::uuid AS film_id WHERE false)
SELECT count(*) AS watched_n, count(*) < 8 AS forming,
       CASE WHEN count(*)=0 THEN NULL ELSE round(100.0*sum(1)/8,1) END AS nav_guarded,
       coalesce(sum(0),0) AS empty_sum;
```

**실측 결과:** `watched_n=0 · forming=true · nav_guarded=null · empty_sum=0`.

> NAV는 `null`(헤더 "형성 중(0편)"), `SUM`은 빈 집합에서 `0`, 백분위/평균은 `null` — **`NaN` 0건.** §2.6 SQL의 `count<8 → null` 분기, `coalesce(...,0)`가 이를 강제. **수용 테스트 4 통과.** Δindex는 콜드스타트에서 *오히려 강조*(거의 모든 라인이 공백 → 큰 +N) → 형성 가속 동기.

---

## 6. 수용 테스트 (예측가능성 — 전부 실데이터로 검증됨)

| # | 테스트 | 검증 방법 | 결과 |
|---|---|---|---|
| **1** | 어떤 영화를 더해도 NAV 비감소(단조) | §2.3 4축 비감소 증명 + §2.7 `watched`=교집합 카운트 실증 | ✓ 구조적 |
| **2** | Δindex "+N"이 *공백 메우는* 영화에서 *포화 영역* 영화보다 큼 | §3.3 Central Station Δbreadth **2.500** > Citizen Kane **2.080** (실데이터) | ✓ |
| **3** | 0 watched facet/region이 블라인드로 표면화 | §4.4 라틴 national 0/100 → `opportunity≈0.78` "첫 진입" (실데이터) | ✓ |
| **4** | 0편 유저 "형성 중", NaN 0건 | §5 `forming=true · nav=null · empty_sum=0` (실측) | ✓ |
| **5**(파생) | 저평점은 NAV 안 깎음(관람 ≥0, drawdown은 P&L만) | §2.2 `depth = max(0, rating10−6)` → ★3 이하 0 기여 | ✓ 구조적 |
| **6**(파생) | 재계산 reshuffle 0 | 모든 정렬 `…, film_id`/`…, slug` tie-break (Phase0 §⑤) | ✓ |

---

## 7. 다른 엔진과의 인터페이스 (계약)

**이 Phase가 *받는* 입력:**

| 출처 | 쓰는 산출물 |
|---|---|
| Phase 1 ② `film_scores.prestige_score`(Fix-A 후) | NAV prestige 축 · Δindex prestige 항 |
| Phase 1 ② `film_scores.discovery_score`(Fix-B) | NAV disc 축 · Δindex disc 항 |
| Phase 1 ⑦ `my_lineage_coverage()` | NAV breadth 축 · ④ 절대 결핍 분자 |
| Phase 0 ① watched predicate · `me_summary.forming` | NAV/Δindex/블라인드 *본 영화 집합*(단일 소스) · 콜드스타트 게이트 |
| `lineage_lists.authority_weight·film_count` | breadth 가중 · 결핍 분모·권위 |
| `user_movies.rating` | NAV depth 축(분포 위치) |
| **Phase 2 ① `{v_watched, anchors, confidence, dist_*}`** | ④ `productivity`·`underindex`(소비만 — *재설계 금지*, §4.2) |

**이 Phase가 *내보내는* 산출물(계약):**

| 소비처 | 산출물 |
|---|---|
| 모든 헤더(현황·운용·프로필) | `compute_portfolio_nav()` → `nav` · `level` · `nav_components`(설명가능성) |
| ⑤ WWI / 볼 영화 카드 (Phase 2 §7) | **`delta_index(film)`** = "→ NAV +N"(자산 논거·정렬 키) · `my_blind_spots()` = WWI `gap`/`conquer` 이유 소스 |
| 현황 블라인드 패널 | `my_blind_spots()` → 기회점수 랭킹 · "첫 진입/보강" 라벨 |
| 공개 프로필 | `level`(NAV 절대값 비공개 가능) · 축별 백분위 뱃지(`nav_components`) |

**WWI 경계(Phase 2):** `score_watchlist()`/WWI 재설계는 Phase 2 — 본 문서는 **건드리지 않는다.** Δindex를 *WWI의 한 논거*로 내보낼 뿐, WWI 내부 가중은 Phase 2 소관.

---

## 8. 적용·검증 순서 (전부 제안 — 승인 후) · Phase 3이 닫는 것

**적용 순서(선행 의존):**
1. **Phase 1 Fix-A·Fix-B 선적용 필수**(실측 사실 ②) — NAV prestige·disc 축이 v2 정전가에 의존. v1 위에 NAV를 박으면 옛 명작 보유가 저평가.
2. `compute_portfolio_nav()` · `delta_index()` · `my_blind_spots()` 추가(§2.6·3.2·4.3).
3. **단조 단위테스트:** 임의 사용자에 본 영화 +1 → `nav` 비감소, 모든 라인 `watched` 비감소 확인.
4. **Δindex 회귀:** §3.3 바스켓에서 gap-filler Δbreadth > saturated Δbreadth 재확인(2.500 > 2.080).
5. **콜드스타트:** 0편 유저 → `nav=null·forming=true`, NaN 0건(§5).
6. **레벨 밴드 게이트:** 사용자 코퍼스 < ~30명이면 레벨/백분위 미표시(§2.4) — 라이브가 1명이므로 *현재는 NAV 숫자 + "형성 중(코퍼스)"* 만.
7. ① 미완성 구간 `productivity=1` 중립 폴백 확인(④ graceful degrade).

DB는 이 문서 작성 시점까지 **미수정** — 모든 SQL은 제안.

**닫음:** NAV 단조(봐서 안 떨어짐) · Δindex가 공백을 보상(포화 영역 한계기여 0 수렴) · 절대 결핍 블라인드(라틴 0편 → 블라인드) · 0편 콜드스타트 NaN 0건. 4개 수용 테스트 전부 **실데이터로 검증**.

**남김(다음 Phase / 의존):** ① 취향 벡터(Phase 2) 완성 시 ④의 `productivity`·`underindex`·편향 게이지 풀가동(상대 under-index) · `takes`/다시보기 테이블 적재 시 NAV depth 축 확장 · 사용자 코퍼스 성장 시 레벨 밴드 백분위 실캘리브레이션 · P&L(hit/regret/자산곡선)은 `08-nav-level.md` §4-d 형태로 별도 산출(NAV 절대값엔 미가산).

---

*Phase 3 = 성장의 세 숫자(NAV·Δindex·블라인드)를 *멤버십 기하*(②⑦) 위에 정직하게 세우는 단계. 단조(C)와 빈 상태(D)를 구조로 박아, "봐서 안 떨어지고 · 다음 한 편의 값이 보이고 · 안 본 곳이 안 본 곳으로 보인다." ①(취향) 의존부는 인터페이스로만 참조 — Phase 2가 채운다.*
