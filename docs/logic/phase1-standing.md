# Phase 1 — 내 것이 정확하다: 정전가 재캘리브레이션 · Discovery 부활 · 커버리지

> **기준은 Phase 0과 동일.** 추측이 아니라 라이브 Supabase의 *실제 함수 소스·컬럼·행*을 열람해 그 위에 설계한다. **DB는 수정하지 않는다 — 모든 SQL은 "제안"이며 승인 후에만 적용.** 예측가능성(least astonishment)이 유일한 합격 기준. 작성 2026-06-26. 폴더: `/Users/jerryje/Documents/MetaTake/docs/logic/`. 선행: `phase0-invariants.md`.

---

## 0. Phase 1이 닫는 astonishment (실측으로 확인됨)

사용자가 *자기가 본 영화*를 봤을 때 거꾸로 보이는 세 가지:

| # | 증상 (실측) | 사용자가 느끼는 배신 |
|---|---|---|
| **A** | Vertigo **40** · Tokyo Story **41** · 2001 **40** · Stalker **34** · Parasite **94** | "내가 본 명작들의 가격표가 거꾸로다" |
| **B** | Discovery 점수가 **거의 전부 0** | "발굴/희소 축이 항상 비어 있다" |
| **C** | (A의 귀결) Vertigo 정전가 40 vs 내 별점 ★4.6(92) → 가치뱃지 "고평가 실망/find" | "시스템이 명작을 저평가 매물로 오판한다" |

세 증상은 **하나의 함수** `compute_film_scores()`의 두 결함에서 나온다. 아래는 그 소스를 직접 열람한 진단이다.

---

## 1. 진단 — `compute_film_scores()` 소스 열람

함수는 영화별로 계보 가입 한 줄마다 기여도 `c`를 계산하고, 내림차순 기하감쇠 합 `raw = Σ c·0.6^(k−1)` 를 정규화(`100·raw/2.42`, 상한 100)한다. 두 결함:

### Root A — canon(정전 등재)이 구조적으로 저평가됨 → 시간 편향

비-auteur 기여도:

```
c = authority_weight × f_result × f_position
   f_result : won 1.0 · runner-up 0.6 · nominated 0.45 · listed 0.45 · selected 0.30
   f_position(canon만): 0.5 + 0.5·(1 − (rank−1)/(rank_max−1))   → rank1 1.0, 바닥 0.5
```

**정전 등재의 result는 전부 `listed` → 계수 0.45.** 즉 "**Sight & Sound 역대 위대한 영화 비평가 투표 2위**"(영화사 최고 권위 랭킹)가 `aw 0.98 × 0.45 × 0.995 ≈ 0.44` 인데, **팔므도르 1회 수상**(`won`)은 `aw 0.97 × 1.0 ≈ 0.97`. **정전 정점이 수상 1회의 절반 이하.**

Vertigo(1958, 오스카 무관 — 당대엔 외면받았고 가치가 *오직 정전 랭킹에* 있음)의 실제 6개 가입을 추적:

| 가입 | result | rank | aw | c (현행) |
|---|---|---|---|---|
| S&S 비평가 투표 | listed | #2/100 | 0.98 | 0.439 |
| S&S 감독 투표 | listed | #6/104 | 0.95 | 0.417 |
| TSPDT 1000 | listed | #2/994 | 0.92 | 0.414 |
| AFI 100 | listed | #9/100 | 0.80 | 0.346 |
| Cahiers 100 | listed | #8/100 | 0.74 | 0.321 |
| National Film Registry | listed | — | 0.60 | 0.270 |

`raw = 0.439 + 0.417·0.6 + 0.414·0.36 + 0.346·0.216 + 0.321·0.13 + 0.27·0.078 ≈ 0.975` → `100·0.975/2.42 = 40.3`. **실측 Vertigo 40.3과 정확히 일치** — 진단 확정.

→ **시간 편향의 정체:** 수상은 당대 제도(오스카·칸)의 산물이라 옛 영화·비서구 영화에 적게 붙는다. 그들의 가치는 *후대의 정전화(canon)* 에 쌓이는데, 그 정전화가 `listed=0.45`로 깎인다. 그래서 Parasite(2019, 칸·오스카 석권)는 94, Vertigo·Tokyo Story·2001은 40대.

### Root B — Discovery가 사문화됨

```
disc = max over (strategic_tier ∈ {S2,S3}) of [ aw × f_result × (selectivity / maxsel) ]
```

`strategic_tier`는 **399개 리스트 중 334개가 NULL** (S1–S4는 *영화제* 라인에만 부여됨: S1 34 · S2 16 · S3 8 · S4 7). S2/S3 가입 `film_lineage` 행은 전체 **453개뿐.** → canon·award만 가진 영화(즉 명작 대부분)는 S2/S3 가입이 0 → **disc=0.** Discovery는 "전위 영화제 수상작"에만 켜지는 죽은 축이 되었다. (`selectivity`는 275/399에 채워져 있어 신호 자체는 살아있음 — 게이트가 문제.)

---

## 2. Fix A — canon 순위-등급 가중 (정전가의 핵심 수정)

**정전 최상위는 수상에 버금가는 인정이다.** canon 기여도를 `listed` 고정에서 *순위 연속 곡선*으로 바꾼다:

```
canon facet:
   rank 있음:  c = aw × ( 0.45 + 0.50 × pos_norm )          -- rank1 → aw×0.95, 바닥 → aw×0.45
              pos_norm = 1 − (rank−1)/(rank_max−1)
   rank 없음:  c = aw × 0.55                                  -- 무순위 등재(예: NFR)
award · national · section:  변경 없음 (won 1.0 … selected 0.30)
auteur:                       변경 없음 (aw × 0.6)
```

원리: S&S #1 = `aw×0.95`(수상급), 바닥 등재 = `aw×0.45`(기존 `listed` 하한과 동일 — **어떤 영화의 canon 기여도도 감소하지 않음**, 곡선이 위로만 들림). 수상을 못 받았어도 정전 정점이면 정점값을 받는다.

### 검증 — 실데이터 바스켓 시뮬레이션 (읽기 전용, 함수 미변경)

전 5,985편에 새 공식을 SELECT로 적용해 비교:

| 영화 | OLD | **NEW** | 해석 |
|---|---|---|---|
| Parasite (2019) | 93.8 | **93.9** | 정점 유지 (정전+수상 양쪽) |
| The Godfather (1972) | 84.7 | **92.7** | 정전+수상 폭 |
| Citizen Kane (1941) | 68.4 | **89.5** | 제자리 |
| In the Mood for Love (2000) | 56.2 | **87.1** | ↑ |
| Mulholland Drive (2001) | 70.3 | **86.5** | ↑ |
| La La Land (2016) | 84.8 | **84.9** | 수상형, 불변 |
| Tokyo Story (1953) | 41.2 | **84.4** | ✓ 복구 |
| Persona (1966) | 60.4 | **84.2** | ↑ |
| **Vertigo (1958)** | **40.3** | **84.2** | ✓ 복구 |
| 2001 (1968) | 40.3 | **83.7** | ✓ 복구 |
| Seven Samurai (1954) | 56.3 | **82.3** | ↑ |
| Stalker (1979) | 34.0 | **71.3** | ↑ |
| The Dark Knight (2008) | 27.8 | **53.5** | 대중작, 합리적 |

서열이 *설명가능하게* 정렬됨: 정점(Parasite·Godfather·Kane 90+) → 심층 정전(Vertigo·Tokyo Story·2001·Persona 80대 초) → 변경기(Stalker 71) → 대중작(Dark Knight 53). **Godfather(92.7) > Vertigo(84.2)** 인 이유도 일관: 전자는 *정전+수상 양쪽* 인정, 후자는 *정전만*(1958년 무관) → 인정의 **폭**이 더 넓음. 깊이(정전)는 둘 다 정점.

### 분포 / 정규화 상수 C

새 `raw` 분포(전 코퍼스): `p25=0.36 · p50=0.72 · p90=1.35 · p95=1.69 · p99=2.10 · max=2.27`. **C=2.42 유지**: max 2.274 → 94 (상한 적체 없음), p95 → 70, p50 → 30. (코퍼스 중앙값이 30인 것은 정상 — 채점 대상엔 단일 약한 등재만 가진 무명작이 많고, 정전가는 *절대* 시장가라 그런 영화는 낮아야 한다.) **C는 캘리브레이션 노브**: 목표 = 정점 ≈ 94 · 심층 명작 80+ · 대중 명작 50대. 적용 후 회귀 표(이 절)로 재확인.

---

## 3. Fix B — Discovery 재설계 (인기 역가중)

죽은 게이트(`strategic_tier`)를 폐기하고 **인기의 역수**로 정의한다. 신호: `film_ratings.imdb_votes` — **6,606편**에 존재(채점 5,985편 전부 포함). (tmdb 인기도·vote_count는 0편 = 미저장이므로 imdb_votes가 유일·충분.) 로그분포(`p10=185 · p50=5,955 · p90=215,298 · max=3.18M`)라 log10 정규화:

```
pop_norm  = clamp( (log10(votes) − 2.5) / (6.0 − 2.5), 0, 1 )    -- ≈300표→0, ≈1M표→1
discovery_factor = 1 − pop_norm                                  -- 덜 알려질수록 ↑
discovery_score  = round( prestige × discovery_factor, 1 )        -- 인정 × 희소
votes 없음 → pop_norm=1 → discovery_factor=0 → discovery 0 (데이터 없으면 발굴 주장 안 함, NaN 0건)
```

`prestige ×` 를 곱하는 이유: 발굴은 "**덜 알려졌지만 좋은**" 영화여야 한다. 무명+저정전 = 그냥 무명(발굴 아님) → 자동으로 낮게.

바스켓(정전 84대 영화들 사이):

| 영화 | imdb_votes | discovery_factor | discovery_score |
|---|---|---|---|
| Tokyo Story | 76,665 | 0.32 | ≈ 27 |
| Stalker | 155,355 | 0.23 | ≈ 16 |
| In the Mood for Love | 184,505 | 0.21 | ≈ 18 |
| Vertigo | 458,761 | 0.10 | ≈ 8 |
| Parasite / Godfather | 1.1M / 2.2M | ≈ 0 | ≈ 0 |

= "덜 알려진 명작 = 발굴 자산." 직관과 정확히 일치.

### 정전가(가격)에는 섞지 않는다

**Standing(정전가, 화면에 보이는 가격) = prestige만.** "인정 = 가격"이 가장 직관적이다. `discovery_score`는 **별도 축으로 저장**해 (a) 포트폴리오 성향 분석(정전형 vs 프론티어형, command-center), (b) WWI `frontier` 이유(엔진⑤, Phase 2 §7), (c) NAV `disc` 축(Phase 3 §2.1)에서 소비한다. 따라서 `total_score = prestige_score`(표시가 = 순수 정전). *(대안: `total = prestige + 0.15·discovery` 내재가 — 희귀자산 프리미엄. 옵션으로 명시하되 기본은 분리. 가격이 "덜 유명해서 더 비싸다"로 보이는 혼란을 피함.)*

---

## 4. 제안 `compute_film_scores()` v2 — 전문 (미적용)

```sql
-- 제안(PROPOSED). 승인 후 적용. DB 현행 미수정.
create or replace function public.compute_film_scores()
returns integer language plpgsql as $function$
declare n int;
begin
  delete from public.film_scores;
  insert into public.film_scores(film_id, track, prestige_score, discovery_score,
                                 total_score, components, model_version, computed_at)
  with contrib as (
    select fl.film_id, ll.facet, ll.label, coalesce(ll.authority_weight,0) as aw,
           fl.result, le.year as yr,
           case
             when ll.facet = 'auteur' then coalesce(ll.authority_weight,0) * 0.6
             when ll.facet = 'canon'  then coalesce(ll.authority_weight,0) *
                  (case when fl.rank is not null and le.rank_max is not null and le.rank_max > 1
                        then 0.45 + 0.50 * (1 - (fl.rank - 1)::numeric / (le.rank_max - 1))
                        else 0.55 end)
             else coalesce(ll.authority_weight,0) *
                  (case fl.result when 'won' then 1.0 when 'runner-up' then 0.6
                                  when 'nominated' then 0.45 when 'listed' then 0.45
                                  when 'selected' then 0.30 else 0.45 end)
           end as c
    from public.film_lineage fl
    join public.lineage_lists ll on ll.id = fl.list_id
    left join public.lineage_editions le on le.id = fl.edition_id
    where ll.status = 'active'
      and ll.facet not in ('movement','style')   -- 정전가 facet 범위(Phase 0 ⑩ · INDEX §4): movement/style 제외(닮음≠품질)
  ),
  ranked as (
    select *, row_number() over (partition by film_id order by c desc nulls last) as k
    from contrib where c > 0
  ),
  raw as (select film_id, sum(c * power(0.6, k - 1)) as raw from ranked group by film_id),
  comp as (
    select film_id, jsonb_agg(jsonb_build_object('label', label, 'c', round(c,3),
             'year', yr) order by c desc) as comps
    from ranked where k <= 6 group by film_id
  ),
  pop as (   -- 인기 역가중: 채워진 곳만, 없으면 pn=1 → discovery 0
    select fr.film_id,
           greatest(0, least(1, (log(10, greatest(fr.imdb_votes,1)) - 2.5) / 3.5)) as pn
    from public.film_ratings fr where fr.imdb_votes is not null
  )
  select r.film_id, 'all',
         least(100, round(100 * r.raw / 2.42, 1))                              as prestige,
         round(least(100, round(100 * r.raw / 2.42, 1)) * (1 - coalesce(p.pn,1)), 1) as discovery,
         least(100, round(100 * r.raw / 2.42, 1))                              as total,  -- 표시가 = 순수 정전
         coalesce(c.comps, '[]'::jsonb), 'v2', now()
  from raw r
  left join comp c on c.film_id = r.film_id
  left join pop  p on p.film_id = r.film_id;
  get diagnostics n = row_count;
  return n;
end $function$;
```

변경 요약: ① canon 기여도 순위-등급화, ② Discovery를 `strategic_tier` 게이트 → `imdb_votes` 인기 역가중으로 교체, ③ `total = prestige`(표시가 분리), ④ `model_version 'v1'→'v2'`(캐시 무효화 트리거).

---

## 5. 귀결 — 가치뱃지 정합 자동 회복 (Phase 0 §③)

가치뱃지 수식은 Phase 0 그대로(`gap = rating_pct − prestige`, find ≥+12 · over ≤−9). **입력(정전가)이 바로잡히면 출력이 바로잡힌다:**

- **이전:** Vertigo 정전 40, 내 별점 ★4.6→92 → `gap = +52` → 거짓 "저평가 발굴(find)". (명백한 정전을 역발상 매물로 오표시.)
- **이후:** Vertigo 정전 84 → `gap = +8` → **"정전 합치(fit)"**. 정전이면서 내가 사랑함 = 합치. 정정 완료.

즉 옛 명작들이 일괄적으로 거짓 "발굴"에서 올바른 "합치"로 이동한다. 별도 코드 없음 — Fix A의 부수효과.

---

## 6. 커버리지 ⑦ — 신규 RPC (단조 보장)

기존 `lineage_index()`는 리스트 카탈로그(`film_count`)만 반환하고 *내가 몇 % 봤나*는 없다. 신규 제안:

```sql
-- 제안(PROPOSED). "내가 본 영화 ∩ 라인 멤버 / 라인 크기"
create or replace function public.my_lineage_coverage()
returns table(list_id uuid, facet text, slug text, label text, country text, tier text,
              total int, watched int, pct numeric)
language sql stable security definer set search_path = public as $function$
  with mine as (
    select um.film_id from public.user_movies um
    where um.user_id = auth.uid()
      and (um.seen is true or um.rating is not null)   -- Phase 0 watched predicate
  )
  select ll.id as list_id, ll.facet, ll.slug, ll.label, ll.country, ll.tier,
         ll.film_count as total,
         count(*) filter (where fl.film_id in (select film_id from mine)) as watched,
         round(100.0 * count(*) filter (where fl.film_id in (select film_id from mine))
               / nullif(ll.film_count, 0), 1) as pct
  from public.lineage_lists ll
  join public.film_lineage fl on fl.list_id = ll.id
  where ll.status = 'active' and ll.film_count > 0          -- Phase 0 ⑩ 단일 계보 우주
  group by ll.id, ll.facet, ll.slug, ll.label, ll.country, ll.tier, ll.film_count
  order by ll.facet, watched desc, pct desc, ll.slug;   -- "많이 본 게 위", slug tie-break
$function$;
```

**단조 보장(astonishment guard):** `watched`는 *본 영화 집합과의 교집합 카운트* → 영화를 더 보면 절대 감소 불가, `pct` 분모는 고정 `film_count` → 더 보면 단조 증가. 사용자가 한 편 더 보고 커버리지가 *내려가는* 일은 구조적으로 불가능. 정렬 `watched desc` = "많이 본 라인이 위", `, ll.slug` = Phase 0 §⑤ 안정 정렬(재로드 reshuffle 0).

**단일 소스·계보 우주(Phase 0 ⑩):** 이 RPC가 *계보 커버리지의 단일 소스*다 — Phase 3 breadth/blindspot·Phase 4 완파가 모두 이것(또는 동일 술어 `status='active' AND film_count>0`)을 경유한다. 반환에 **`list_id` 포함**(교차검토 업그레이드) → 하위 소비자는 `slug` 문자열 조인 대신 `list_id`로 결합(견고). facet 범위도 정전가와 동일(`movement·style` 제외 — 멤버십 0건이라 현재 자연 제외).

**신선도 주의:** `watched`는 `film_lineage`에 *적재된* 멤버십 기준이다. 라인 공식 크기(`film_count`)와 적재 멤버십이 부분 불일치하면 `pct`가 과소 표시될 수 있음 → "멤버십 적재율" 메타로 노출 권장.

---

## 7. 적용·검증 순서 (전부 제안 — 승인 후)

1. `compute_film_scores()` v2 교체 → `select public.compute_film_scores();` (5,985행 재계산).
2. **회귀 테스트:** §2 바스켓 13편 old/new 대조 + 분포(p50≈30 · p95≈70 · max≈94) 확인.
3. **단조 단위테스트:** `my_lineage_coverage()` 추가 후, 임의 사용자에 본 영화 +1 시 모든 `pct` 비감소 확인.
4. **목업 대조:** command-center 커버리지 바 · collection-list 가격 칸이 새 값과 모순 없는지.
5. `model_version` 'v1'≠'v2' 캐시 무효화 확인.

DB는 이 문서 작성 시점까지 **미수정** — 모든 SQL은 제안.

---

## 8. Phase 1이 닫는 것 / 다음 (Phase 2)

**닫음:** 정전가 신뢰(명작=명작값, 시간 편향 제거) · Discovery 부활(별도 축, 인기 역가중) · 가치뱃지 정합 자동 회복 · 커버리지 단조.

**다음 Phase 2 "나에게 맞다":** 취향 벡터(엔진①) 구축 + `score_watchlist`에 taste 주입. 현재 `score_watchlist`는 **taste-blind**임을 소스로 확인함 — `canon = prestige_score`(Fix A로 자동 정정됨), `lineage = 트로프 중복 + 동일감독 보너스`, `gap = 신규 국가/연대/감독`, 주관(취향) 항이 **0**. WWI(엔진⑤)가 사용자의 ①을 먹기 시작하는 것이 Phase 2의 심장.

---

*Phase 1 = 객관 기둥(②정전가)을 실데이터로 바로 세우는 단계. 주관 기둥(①취향)은 Phase 2.*
