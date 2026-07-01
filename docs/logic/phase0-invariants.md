# Phase 0 — 정합 척추 (Invariants) · 라이브 DB 기반 설계

> `INTUITION-ORDER.md`의 Phase 0. **라이브 Supabase(`jvgarcqrtsmgfimdcwgo`/kyniq)를 실측해** 그 실제 컬럼·제약 위에 설계한다. SQL은 전부 *제안*(적용 전 — **DB 미수정**). 모든 엔진·RPC가 이 층을 상속한다. 작성 2026-06-25. Postgres 17.

---

## 0. 이 설계가 선 땅 (실측 요약)

| 대상 | 실측한 실재 |
|---|---|
| **`user_movies`** | PK `(user_id, film_id)` · `rating numeric NULL` **CHECK(0.5–5, half-star)** · `seen bool NOT NULL default false` · `watchlist bool NOT NULL default false` · `watched_at date` · `note` · `visibility text default 'private' CHECK(private/public)` · FK→films ON DELETE CASCADE · RLS(본인 rw + `visibility='public'` read) |
| **`films`** | `id·slug·title·original_title·year·runtime·director·director_slug·genres[]·keywords[]·imdb_id·tmdb_extra jsonb·visible·hold·in_seed_catalog·aesthetic_level/label·poster_path·backdrop_path` (visible=1,935 / 총 6,701) |
| **`profiles`** | `id·username·display_name·**country**·**portfolio_public**·is_public·reputation·role·account_status` |
| **`film_scores`** | `film_id·track('all')·prestige_score·discovery_score·total_score·components jsonb·model_version` (5,985행) |
| **`film_watch_providers`** | `film_id·results jsonb`(국가별 `{flatrate/rent/buy/link}`, 각 항목 `provider_name`)·`countries[]`·`fetched_at` (KR 2,358편) |
| **기존 RPC(재사용)** | `compute_film_scores()` · `score_watchlist()→(film_id,…,wwi,canon,lineage,gap,reason)` · `portfolio_breakdown()jsonb` · `public_portfolio(username)`·`public_portfolio_meta` · `film_lineage_for(film_id)` · `lineage_index/list_films/add_watchlist` · `home_bundle/counts/pool` · `get_my_pins` · `refresh_home_cache` |

**⚠ 실측에서 드러난 두 결함(Phase 0 아님, 기록만):**
1. **정전가 정합 깨짐** — Parasite P=94지만 **Vertigo 40·Tokyo Story 41·2001 40·Stalker 34**(S&S #1급이 최신 수상작보다 낮음), **Discovery 전부 0**. → Phase 1 `compute_film_scores` 재캘리브레이션 + Discovery 부활.
2. **`score_watchlist()`는 taste-blind** — canon/lineage/gap만, *개인 취향(①) 없음*. → Phase 2에서 ① 결합.

---

## 불변식 ① — 본 영화 판정 (the keystone predicate)

**직관 계약 A:** "평점 준 영화는 본 영화. 화면 플래그와 무관." 안 본 영화엔 평점을 못 주므로 `rating ⟹ seen`.

**단일 predicate (모든 엔진·RPC가 이것만 본다):**
```sql
watched := (user_movies.seen IS TRUE) OR (user_movies.rating IS NOT NULL)
```

**구현 — 정규화 뷰 (single source of truth).** RLS를 보존하려면 PG15+ `security_invoker`:
```sql
create or replace view public.v_user_film
  with (security_invoker = true) as
select
  um.user_id,
  um.film_id,
  (um.seen is true or um.rating is not null)                        as watched,       -- ① 불변식
  um.rating                                                          as rating5,       -- 원본 0.5–5
  case when um.rating is not null then um.rating * 2  end            as rating10,      -- 내부 0–10 (③)
  case when um.rating is not null then um.rating * 20 end            as rating_pct,    -- 0–100 (정전가 비교용, ③)
  (um.watchlist and not (um.seen is true or um.rating is not null))  as in_watchlist,  -- 본 영화는 후보 아님 (⑥)
  um.watched_at, um.visibility, um.added_at
from public.user_movies um;
```
**적용처:** 엔진①(취향 집합 = `watched`), ⑦(커버리지 분자), ⑤(후보 = `NOT watched`), 모든 카운트. *원시 `user_movies`를 직접 읽는 코드는 전부 `v_user_film` 경유로 교체.*

**수용 테스트(예측가능성):** `seen=false·rating=3.5`인 행이 `watched=true`로 나온다 · 그 영화는 어떤 추천에도 안 뜬다.

---

## 불변식 ② — 단일 소스 카운트 (어디서나 142 = 142)

**직관 계약 A:** "보유 142편은 모든 화면에서 142."

**구현 — 단일 요약 RPC.** 현황·보유·프로필 헤더가 *각자 쿼리하지 않고* 이것만 호출:
```sql
create or replace function public.me_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'watched',     count(*) filter (where watched),
    'watchlist',   count(*) filter (where in_watchlist),
    'rated',       count(*) filter (where rating5 is not null),
    'avg_rating5', round(avg(rating5) filter (where rating5 is not null), 1),   -- 평점 매긴 것만 (A)
    'forming',     count(*) filter (where watched) < 8                          -- 콜드스타트 (⑦)
  )
  from public.v_user_film
  where user_id = auth.uid();
$$;
revoke all on function public.me_summary() from public;
grant execute on function public.me_summary() to authenticated;
```
**정합:** 기존 `app/me/page.tsx`의 자체 select, `portfolio_breakdown()`, `home_counts()`가 *같은 predicate·같은 분모*를 쓰도록 통일(특히 평균은 `rated`만 분모).

**수용 테스트:** 현황·보유·프로필의 "보유 N"이 바이트 단위로 동일 · 평균 별점은 미평점 영화에 끌려가지 않음.

---

## 불변식 ③ — 평점 스케일 (0.5–5 ↔ 0–10 ↔ ★5 ↔ 0–100)

**직관 계약 E·I:** 별점은 ★5로 보이고, 내부 계산은 일관되며, 가치 뱃지가 숫자와 안 싸운다.

| 용도 | 식 | 비고 |
|---|---|---|
| 저장 | `rating` 0.5–5 (CHECK 강제) | DB 원본 |
| 표시 | ★ = `rating` (1자리) | half-star |
| 취향 가중(①) | `rating10 = rating*2` (1–10), 중립 `NEUTRAL=6`(=★3) | `w = max(0, rating10 − NEUTRAL)` |
| 가치 뱃지(I) | `rating_pct = rating*20` (0–100) vs `prestige_score`(0–100) | `gap = rating_pct − prestige` |

**가치 뱃지 (결정적):**
```sql
case
  when v.rating_pct - s.prestige_score >= 12 then 'find'  -- 저평가 발굴
  when v.rating_pct - s.prestige_score <= -9 then 'over'  -- 고평가 실망
  else 'fit'                                              -- 정전 합치
end   -- 임계는 가설; 단 prestige 재캘리브레이션(Phase 1) 전엔 신뢰 보류
```
**주의:** 정전가가 아직 미보정(Vertigo 40)이라 이 뱃지는 *Phase 1 이후* 신뢰. 스케일·산술 규약만 Phase 0에서 고정.

**수용 테스트:** ★4.5 = rating_pct 90 · 정전가 60 → gap +30 → "저평가 발굴" (모순 없음).

---

## 불변식 ④ — 반올림·포맷 규약

| 값 | 규약 |
|---|---|
| 정전가·WWI·NAV | 정수 `round()` |
| 별점 | 1자리 `★3.5` |
| 커버리지·% | 정수 `round(100.0*seen/total)`, 합 100 보장 |
| Δindex | 부호 정수 `+5` |
| NAV | 천단위 구분 `1,284` |
| 만료 | `D-5` (일 단위 floor) |

**수용 테스트:** `86.9999` 같은 표기 0건 · % 합이 100을 안 넘김.

---

## 불변식 ⑤ — 결정적 안정 정렬 (tie-break = film_id)

**직관 계약 B·H:** "리스트를 다시 열어도 순서가 안 흔들린다."

**규약:** *모든 정렬 쿼리의 마지막 ORDER BY 항은 안정 키 `film_id`*(동률 시 물리 순서 의존 금지).
```sql
-- 점수순:        order by wwi desc, film_id
-- 최근 관람순:   order by watched_at desc nulls last, added_at desc, film_id
-- 정전가순:      order by prestige_score desc, film_id
-- 만료 임박순:   order by min_expiry asc nulls last, wwi desc, film_id
```
**수용 테스트:** 동일 입력으로 RPC 2회 호출 → 순서 완전 동일 · 동점 영화들이 매번 같은 순서.

---

## 불변식 ⑥ — de-dup & seen/watchlist 배타

- **원천 중복 없음:** `user_movies` PK `(user_id, film_id)` 가 1행 보장 ✓ (DB가 강제).
- **조인 중복:** 한 영화가 여러 계보에 = 정상이나, 영화 리스트 집계는 `distinct film_id` 또는 영화 단위 aggregate.
- **seen/watchlist 배타(표시):** `v_user_film.in_watchlist = watchlist AND NOT watched` → *본 영화는 "볼 영화"에 안 뜸* (계약 A). 데이터는 둘 다 true일 수 있으나 표시는 배타.

**수용 테스트:** 한 영화가 보유 리스트에 두 번 안 나옴 · 평점 준 영화가 워치리스트 카운트에서 빠짐.

---

## 불변식 ⑦ — 콜드스타트·빈 상태 (NaN 0건)

**직관 계약 D:** "0편 유저도 깨진 화면을 안 본다."

- `watched=0` → `me_summary.forming=true`, 평균/NAV는 `null`(NaN 금지), UI "형성 중".
- 추천 콜드스타트: `watched < 8`이면 `score_watchlist`의 *주관 성분(safe/taste)을 0으로* 두고 canon/popularity 폴백(현 `score_watchlist`가 이미 canon/lineage/gap 반환 → 자연 폴백).
- 계보 없는 영화: 정전가 `null` → "미평가"로 표시(0점 아님). 또는 `film_ratings.imdb_rating` 폴백 사전치.

**수용 테스트:** 새 계정(0편) 대시보드에 `NaN`·빈 에러 0건 · "형성 중" 노출.

---

## 불변식 ⑧ — 지역·신선도 가용 (계약 G)

**직관 계약 G:** "MUBI에서 지금 = 내 지역에서 진짜."

- **사용자 지역** = `profiles.country`(없으면 'US' 폴백).
- **지금 볼 수 있는(구독)** = `film_watch_providers.results -> {country} -> 'flatrate'`.
```sql
create or replace function public.film_availability(p_film_id uuid, p_country text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (select coalesce(p_country,
                 (select country from profiles where id = auth.uid()), 'US') as cc)
  select jsonb_build_object(
    'country',   (select cc from c),
    'flatrate',  coalesce((select jsonb_agg(p->>'provider_name')
                   from film_watch_providers fwp, c,
                        jsonb_array_elements(fwp.results->(c.cc)->'flatrate') p
                   where fwp.film_id = p_film_id), '[]'::jsonb),
    'has_data',  exists(select 1 from film_watch_providers
                   where film_id = p_film_id and results ? (select cc from c)),
    'stale',     coalesce((select fetched_at from film_watch_providers where film_id=p_film_id)
                   < now() - interval '30 days', true)
  );
$$;
```
- **신선도:** `fetched_at` 30일 초과 → `stale=true` → UI caveat.
- **데이터 없음 ≠ 안 됨:** `has_data=false`면 "이 지역 정보 없음"(공백), "볼 수 없음" 아님.

**수용 테스트:** KR 유저에게 KR `flatrate`만 노출 · US 전용작은 "이 지역 정보 없음" · 30일 지난 정보엔 caveat.

---

## 불변식 ⑨ — 액션 멱등·일관 (계약 H)

- track 업서트는 PK `(user_id, film_id)` 멱등. 평점 입력 → `v_user_film.watched`가 자동 true(별도 seen 세팅 불필요, 단 위생용 트리거는 선택).
- 봤어요/별점/취소는 *모든 화면 즉시 반영*(optimistic) + `v_user_film` 단일 소스라 재조회 시 일관.

**수용 테스트:** 별점 → 즉시 보유에 등장·워치리스트에서 사라짐 · 취소 → 원복.

---

## 불변식 ⑩ — 단일 계보 우주 (lineage universe; P1/P3/P4 공통)

**직관 계약 A(일관성):** "어느 화면에서 세든 계보의 모집단은 같다." 정전가(②)·커버리지(⑦)·breadth·블라인드(⑧④)·완파(Phase 4)가 *서로 다른 계보 집합*을 세면 카운트가 어긋난다 — `user_movies`의 watched predicate(①)와 같은 위상의 *콘텐츠 측 단일 술어*가 필요하다.

**단일 술어 (모든 계보 집계가 이것만 본다):**
```sql
lineage_universe := lineage_lists.status = 'active' AND lineage_lists.film_count > 0
```
실측(2026-06): `status` 컬럼 존재(399행 전부 `active`), `film_count>0` = 275행 → *현재 두 조건의 결과는 동일*하나 **술어를 하나로 고정**해 향후 한 리스트가 비활성화되면 전 소비자가 일제히 제외(드리프트 방지). **`my_lineage_coverage()`(Phase 1)가 이 우주의 단일 소스 RPC** — Phase 3 breadth/blindspot·Phase 4 완파는 그것(또는 동일 술어)을 경유한다. 동 RPC는 `list_id`를 반환 → 하위 소비자는 `slug` 문자열 조인 대신 `list_id`로 결합.

**facet 범위(00-INDEX §4):** 정전가·breadth는 `canon·award·national·auteur·festival·section`만 산입. **`movement·style` 제외**(닮음이지 품질 아님 — 유사 ⑥ 전용). 실측: movement(67)·style(15) 리스트는 존재하나 `film_lineage` 멤버십 0건 → 현재 자연 제외, 단 스펙·SQL에 명시 가드(향후 적재 대비).

**수용 테스트:** 정전가·NAV breadth·커버리지·완파가 세는 라인 모집단이 *동일 술어* · movement/style이 정전가에 0 기여 · 비활성화 리스트가 어디서도 안 세짐.

---

## 적용 체크리스트 (Phase 0 산출물)

1. `v_user_film` 뷰(`security_invoker`) — ① 단일 predicate.
2. `me_summary()` RPC — ② 단일 카운트(기존 /me·portfolio_breakdown 정합).
3. 스케일 상수 `NEUTRAL=6`·`rating_pct` — ③.
4. 포맷/반올림 규약(클라이언트+RPC) — ④.
5. 정렬 tie-break 컨벤션(`, film_id`) 전 RPC 적용 — ⑤.
6. `film_availability()` RPC + 신선도 — ⑧.
7. 콜드스타트 `forming`/null 가드 — ⑦.
8. 단일 계보 우주 술어(`status='active' AND film_count>0`) + facet 범위(movement/style 제외) — ⑩ (P1/P3/P4 상속).

이 8개는 *작지만* 모든 예측가능성의 바닥이다. **DB 미수정 — 적용은 승인 후.**

---

## 불변식 ⑪ — visibility 토글 단일 모델 (UX 역반영 · `docs/ux/SHARED-STANDARD.md` S9)

공개/비공개 토글이 보유·서재·노트·프로필에 흩어져 front-only로 구현됨 → 단일 모델로 통일: item-level `user_movies.visibility`('private'/'public', 이미 실재) + 서재 항목·프로필 섹션(`portfolio_public` 화이트리스트). `set_visibility()` RPC(멱등·optimistic). **화이트리스트 투영은 RPC/뷰 레벨 강제** — 프런트 가림은 보조(누출 방지). 표준 UI = 공유 pill(`🌐 공개 중`/`🔒 비공개`).

**수용 테스트:** 한 화면에서 공개 토글 → 모든 화면·공개 프로필에 일관 반영 · 비공개 항목이 공개 투영에 0건 누출.

---

## 다음 (Phase 1)
정전가 재캘리브레이션(Vertigo 40 → ~95, Discovery 0 부활)이 1순위 astonishment. `compute_film_scores()` 내부를 열람해 *시간 편향·순위(f_position)·Discovery 미산출*을 진단하는 것이 Phase 1의 첫 걸음.
