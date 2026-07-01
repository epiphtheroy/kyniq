# Phase 4 — 결을 더하는 것 (delight): 완파 · 발굴 정렬 · podium · 동행 · 공개 프로필

> **기준은 Phase 0과 동일.** 라이브 Supabase(`jvgarcqrtsmgfimdcwgo`)의 *실제 함수 소스·컬럼·행*을 열람해 그 위에 설계한다. **DB는 수정하지 않는다 — 모든 SQL은 "제안(PROPOSED)"이며 승인 후에만 적용.** 예측가능성(least astonishment)이 유일한 합격 기준. 작성 2026-06-26. 폴더: `/Users/jerryje/Documents/MetaTake/docs/logic/`. 선행: `phase0-invariants.md` · `phase1-standing.md` · `01-taste-vector.md`(인터페이스만 소비). 상속: INTUITION-ORDER §F(시간·신선도)·§H(액션 일관성).

---

## 0. Phase 4가 더하는 것 — 그리고 더하지 *않는* 것

INTUITION-ORDER §3에서 Phase 4 = **"오, 이런 것도"(delight; 비필수)**. 핵심 선언: **이 다섯 기능은 *신뢰의 바닥*이 아니다.** 없어도 Phase 0–3의 약속(본 것=본 것, 정전가=명작값, 추천=안 본 것)은 그대로 선다. 그래서 Phase 4의 합격선은 "있으면 기쁘다"가 아니라 **"있어서 *배신하지* 않는다"** — delight 기능조차 예측가능성을 어기면 안 된다(축포가 두 번 터지거나, 새벽에 짝이 둘이거나, 비공개 필드가 새면 → delight가 오히려 불신원).

| # | 기능 | 한 줄 | 가장 위험한 astonishment | 방어 |
|---|---|---|---|---|
| 1 | **도장깨기 완성** | 계보 커버리지가 임계를 넘으면 축하 | 같은 완파가 두 번 축포 / 한 편 뺐는데 또 터짐 | **멱등 가드**(crossed-once) |
| 2 | **저평가 발굴 정렬** | 내 별점↑·정전가↓ 영화를 위로 | 내가 *낮게* 준 영화가 "발굴"로 뜸 | `gap` 정렬 + `rating_pct` 하한 |
| 3 | **순위 podium** | 손으로 고른 1·2·3등 | 재로드마다 순서 셔플 | 명시 `rank` + tie-break |
| 4 | **동행 싱크율** | 매일 무작위 2인 페어 + 취향 코사인 | 새벽에 짝 둘 / 안 바뀜 / 비대칭 | **Asia/Seoul 자정 결정적 seed** |
| 5 | **공개 프로필 투영** | 어떤 엔진 산출을 공개할지 | 비공개·트로프·실명 유출 | **플래그 게이팅 + 화이트리스트** |

> 표기: 정전가 = `film_scores.prestige_score`(Phase 1 재캘리브레이션 후 min 6.0 · median 27.3 · max 94.0, 실측). `rating_pct = user_movies.rating × 20`(Phase 0 ③). `watched := seen IS TRUE OR rating IS NOT NULL`(Phase 0 ①).

**실측 환경 주의(설계 영향):** 현재 DB는 *출시 전* — `profiles` 4행(전부 `is_public=true`, **`portfolio_public=0`**), `user_movies`는 1유저·1편, `user_pins`는 like 1행. 따라서 *사용자 데이터로 완파/싱크율을 라이브 검증할 수 없다.* 대신 **데이터-측 구조**(계보 적재율·정전가 분포·함수 게이트)를 실측해 공식을 못박고, 사용자-측은 콜드스타트·빈 상태가 NaN 없이 서는지를 합격 기준으로 둔다.

---

## 1. 도장깨기 완성 (lineage 완파 · completion milestones)

### 1.1 입력 — `my_lineage_coverage()` (Phase 1 PROPOSED)

Phase 1 §6의 신규 RPC가 라인별 `(list_id, facet, slug, label, total, watched, pct)`를 단조 보장으로 반환한다(교차검토 업그레이드: **`list_id` 직접 반환** → §1.4가 `slug` 문자열 재조인 없이 결합). **완파 감지는 이 출력 위에만 선다** — 별도 카운트 소스를 만들지 않는다(Phase 0 ② 단일 소스).

`pct`의 단조성(영화 더 보면 `watched` 비감소, 분모 `film_count` 고정)이 완파 로직의 *기둥*이다: 임계는 **한 방향으로만** 넘는다 → "넘었다 풀렸다"가 구조적으로 불가능 → 멱등 가드가 단순해진다.

**적재율 실측(완파 신뢰의 근거):** `film_count ≥ 10`인 리스트의 멤버십 적재율 = **award 55개·national 45개·canon 15개 리스트 전부 평균 100.0%**. 즉 *완파를 노릴 만한 크기의 리스트*는 공식 크기와 적재 멤버십이 일치 → `pct=100`이 진짜 100. (`film_count=1`인 auteur 1편 리스트도 100% 적재되나, 1편 완파는 축하 대상에서 제외 — §1.4 `total ≥ MIN_LIST` 게이트.)

### 1.2 마일스톤 정의 (임계 = 계단, 연속 아님)

```
MILESTONES = [50, 75, 100]      -- pct 임계(%), 가설 상수
완파(完破) = 100% 도달          -- 최상위 이벤트(red, conquer 색 — INDEX §4)
```

- 한 라인은 한 임계를 **한 번만** 넘는다(단조성). 50→75→100 순서로만 발화.
- `MIN_LIST = 8`: 너무 작은 리스트는 완파가 시시함 → `total < 8`인 라인은 마일스톤 대상 제외(auteur 1편 리스트 등 노이즈 차단). *가설; 캘리브레이션 대상.*

### 1.3 멱등 "이미 축하함" 가드 — 제안 상태 테이블

`my_lineage_coverage()`는 *현재 상태*만 안다. "이미 축하했나?"는 *상태 전이*라 별도 박제가 필요하다 → STATE 패턴(INTUITION-ORDER §F). 현재 DB에 완파 박제 테이블 **없음**(실측: `%milestone%`·`%celebrat%` 테이블 0개) → 신규 제안.

```sql
-- 제안(PROPOSED). 승인 후 적용. DB 현행 미수정.
-- 한 (유저 × 라인 × 임계)당 한 행만 — PK가 멱등을 강제.
create table public.user_lineage_milestone (
  user_id    uuid    not null references public.profiles(id) on delete cascade,
  list_id    uuid    not null references public.lineage_lists(id) on delete cascade,
  threshold  int     not null check (threshold in (50, 75, 100)),
  watched_at_cross int not null,           -- 넘은 순간의 watched 수(서사·디버그용)
  total_at_cross   int not null,           -- 넘은 순간의 라인 크기(film_count drift 추적)
  celebrated_at timestamptz not null default now(),
  primary key (user_id, list_id, threshold)   -- ← 멱등의 핵심: 두 번째 INSERT는 충돌
);
-- RLS: 본인만 read/write.
alter table public.user_lineage_milestone enable row level security;
create policy own_milestone on public.user_lineage_milestone
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

### 1.4 발화 RPC — crossed-once (멱등)

```sql
-- 제안(PROPOSED). 호출 시점에 "새로 넘은" 마일스톤만 INSERT하고 그것만 반환.
-- 두 번째 호출은 ON CONFLICT DO NOTHING으로 0행 → 축포 한 번.
create or replace function public.fire_lineage_milestones()
returns table(facet text, slug text, label text, threshold int, pct numeric)
language plpgsql volatile security definer set search_path = public as $function$
begin
  return query
  with cov as (                       -- Phase 1 단일 소스 (list_id 직접 반환 — 교차검토 업그레이드)
    select c.facet, c.slug, c.label, c.total, c.pct, c.list_id
    from public.my_lineage_coverage() c
    where c.total >= 8                 -- MIN_LIST 게이트
  ),
  due as (                            -- 현재 pct가 도달한 모든 임계 (계단)
    select cov.*, t.threshold
    from cov
    cross join (values (50),(75),(100)) as t(threshold)
    where cov.pct >= t.threshold
  ),
  newly as (                          -- 아직 축하 안 한 것만
    insert into public.user_lineage_milestone
      (user_id, list_id, threshold, watched_at_cross, total_at_cross)
    select auth.uid(), d.list_id, d.threshold,
           round(d.pct * d.total / 100.0)::int, d.total
    from due d
    on conflict (user_id, list_id, threshold) do nothing   -- ← 멱등
    returning list_id, threshold
  )
  select d.facet, d.slug, d.label, n.threshold, d.pct
  from newly n
  join due d on d.list_id = n.list_id and d.threshold = n.threshold
  order by n.threshold desc, d.slug;   -- 100 먼저, slug tie-break(Phase 0 ⑤)
end $function$;
```

**왜 멱등이 보장되나:** 발화 = `INSERT ... ON CONFLICT DO NOTHING`. PK `(user_id, list_id, threshold)`가 (유저×라인×임계) 1행을 강제 → 같은 완파의 두 번째 호출은 충돌 → `newly` 0행 → 반환 0행 → **축포 정확히 한 번.** "이미 축하함"을 클라이언트가 기억할 필요 없음(서버 박제).

**drift 주의(예측가능성):** `film_count`가 사후에 늘면(라인 확장) 이미 100% 박제된 유저의 `pct`가 100 아래로 내려갈 수 있다. 그래도 **재축포는 없다**(박제는 영구) — `total_at_cross`로 "당시 N편 기준 완파"를 서사에 명시해 모순을 흡수. 새 임계(예: 확장 후 다시 100)는 *다른 행*이 아니므로(같은 threshold=100) 재발화 안 됨 → 보수적·안전.

### 1.5 수용 테스트 (예측가능성)
- **단 한 번:** `fire_lineage_milestones()`를 같은 상태로 2회 호출 → 2회차는 0행. 완파 축포가 절대 두 번 안 터짐.
- **정확히 넘는 순간:** `pct`가 74→75로 오른 직후 1회만 75-마일스톤 1행. 73에서는 0행.
- **순서:** 50·75·100을 한 번에 넘는 점프(예: 0→100, 한 편짜리 라인은 게이트로 제외되지만 큰 라인을 대량 임포트한 경우)에도 세 행이 한 번에·중복 없이.
- **풀림 불가:** 영화를 unrate해도(Phase 0 ⑨ 역연산) `user_lineage_milestone` 행은 남음 — 완파는 *역사*, 회수 안 함.

---

## 2. 저평가 발굴 정렬 (undervalued-find sort / surfacing)

### 2.1 뱃지는 이미 정의됨 — 여기선 *정렬·필터·노출 규칙*만

가치 뱃지 수식은 Phase 0 ③·Phase 1 §5에서 확정: `gap = rating_pct − prestige`, `find ≥ +12 · over ≤ −9 · else fit`. Phase 1의 정전가 재캘리브레이션으로 거짓 "발굴"(Vertigo 40 → 84)은 이미 정정됐다. **Phase 4의 몫은 보유 화면(`collection-list-v2`)의 SORT/FILTER 한 줄.**

### 2.2 grounding — 실컬럼

| 항목 | 실컬럼 | 비고 |
|---|---|---|
| 내 별점 | `user_movies.rating` (0.5–5, NULL 가능) | half-star CHECK |
| 별점 % | `rating × 20` → `rating_pct` (0–100) | Phase 0 ③ |
| 정전가 | `film_scores.prestige_score` (0–100) | Phase 1 v2, 실측 분포 min 6.0/median 27.3/max 94.0 |
| 갭 | `rating_pct − prestige_score` | 양수 클수록 "발굴" |

### 2.3 발굴 정렬 RPC (제안)

```sql
-- 제안(PROPOSED). 보유(seen 또는 rated) 중 "내가 높이 봤는데 정전가는 낮은" 순.
create or replace function public.my_undervalued(p_min_rating numeric default 3.5)
returns table(film_id uuid, slug text, title text, year int,
              rating numeric, rating_pct numeric, prestige numeric,
              gap numeric, badge text)
language sql stable security definer set search_path = public as $function$
  select um.film_id, f.slug, f.title, f.year,
         um.rating,
         um.rating * 20                                   as rating_pct,
         fs.prestige_score                                as prestige,
         (um.rating * 20) - fs.prestige_score             as gap,
         case
           when (um.rating*20) - fs.prestige_score >= 12 then 'find'
           when (um.rating*20) - fs.prestige_score <= -9 then 'over'
           else 'fit'
         end                                              as badge
  from public.user_movies um
  join public.films f       on f.id = um.film_id
  join public.film_scores fs on fs.film_id = um.film_id
  where um.user_id = auth.uid()
    and um.rating is not null            -- 발굴은 *평가한* 영화만 (미평점 제외)
    and um.rating >= p_min_rating        -- ← 핵심 가드: 낮게 준 영화는 절대 "발굴" 아님
    and fs.prestige_score is not null    -- 정전가 없으면 갭 판정 불가 → 제외(NaN 0건)
  order by gap desc, fs.prestige_score asc, um.film_id;   -- 발굴 위, 동률 시 더 무명, film_id tie-break
$function$;
```

**핵심 가드 두 개:**
1. **`rating >= p_min_rating`(기본 ★3.5)** — *내가 낮게 준 영화는 발굴 목록에 구조적으로 못 들어온다.* "발굴 = 내가 사랑한 숨은 보석"이지, "내가 싫어한 무명작"이 아니다. (INTUITION-ORDER §I — 뱃지가 숫자와 안 싸운다.)
2. **`order by gap desc`** — 높은 별점 × 낮은 정전가 = 큰 양수 갭이 맨 위. `over`(고평가 실망, 음수 갭)는 자동으로 바닥. 동률 tie-break `prestige asc`(더 무명인 게 위 = 더 강한 발굴) → 최종 `film_id`(Phase 0 ⑤ 안정 정렬).

**노출 규칙(surfacing):** 보유 화면 상단 "저평가 발굴" 섹션 = `my_undervalued()` 중 `badge='find'` 상위 N. `find`가 0개면 섹션을 *숨김*(빈 카드 금지, Phase 0 ⑦). 콜드스타트(평점 0개) → 0행 → 섹션 미노출, NaN 0건.

### 2.4 수용 테스트
- **낮은 별점 배제:** ★2.0(rating_pct 40) 준 정전가 20 영화는 갭 +20이지만 `rating >= 3.5` 게이트에서 탈락 → **발굴에 절대 안 뜸.**
- **방향:** ★4.5(90)·정전가 50 → 갭 +40 → 최상단. ★4.5(90)·정전가 92 → 갭 −2 → `fit`, 발굴 섹션 밖.
- **재현성:** 2회 호출 → 동률 영화 순서 동일(`film_id` tie-break).
- **콜드스타트:** 평점 0개 유저 → 0행 → 섹션 숨김, 에러/NaN 0건.

---

## 3. 순위 podium (manual 1·2·3 ranking)

### 3.1 실측 — 기존 자산으로는 podium을 못 담는다

`get_my_pins()` 소스를 열람: `user_pins(user_id, entity_type, entity_id, kind, created_at)`, PK `(user_id, entity_type, entity_id, kind)`. **`kind` CHECK = `('follow','like')` 뿐 · rank/순위 컬럼 없음 · `created_at desc` 정렬만.** 즉 `user_pins`는 *좋아요/팔로우*용이고 **1·2·3 순위를 담을 자리가 없다**(`kind`에 'rank'를 넣으려면 CHECK 변경 필요 + 순위 숫자 둘 곳 없음). `%rank%` 테이블은 `frame_rankings`·`meta_take_rankings`뿐 — *영화 podium용 아님*(형상/메타테이크 정렬). → **podium은 신규 저장이 필요(PROPOSED).**

### 3.2 제안 — `user_podium` (좁고 명시적)

```sql
-- 제안(PROPOSED). 손으로 고른 영화 순위. 1·2·3…만, 한 슬롯 한 영화.
create table public.user_podium (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  rank     int  not null check (rank >= 1),       -- 1=금, 2=은, 3=동 …
  film_id  uuid not null references public.films(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (user_id, rank),                    -- 한 순위에 한 영화 (1등은 유일)
  unique (user_id, film_id)                        -- 한 영화가 두 순위 차지 금지(de-dup, Phase 0 ⑥)
);
alter table public.user_podium enable row level security;
create policy own_podium_rw on public.user_podium
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- 공개 읽기는 §5 투영 RPC가 portfolio_public 게이트로만 노출(테이블 직접 공개 RLS 없음).
```

두 제약이 podium의 *least astonishment*를 강제한다:
- **PK `(user_id, rank)`** → 1등은 항상 정확히 하나. 1등을 바꾸면 같은 슬롯 업서트(멱등, Phase 0 ⑨).
- **`unique(user_id, film_id)`** → 같은 영화가 1등이자 2등일 수 없음(중복 금지, Phase 0 ⑥).

### 3.3 읽기 RPC (안정 표시)

```sql
-- 제안(PROPOSED). 내 podium — 순위 오름차순, 안정.
create or replace function public.my_podium()
returns table(rank int, film_id uuid, slug text, title text, year int,
              poster_path text, prestige numeric)
language sql stable security definer set search_path = public as $function$
  select up.rank, up.film_id, f.slug, f.title, f.year, f.poster_path, fs.prestige_score
  from public.user_podium up
  join public.films f on f.id = up.film_id
  left join public.film_scores fs on fs.film_id = up.film_id
  where up.user_id = auth.uid()
  order by up.rank, up.film_id;     -- 순위 우선, film_id tie-break(Phase 0 ⑤; rank가 PK라 동률 없음·방어용)
$function$;
```

**무결성 주의:** podium 영화를 *본 영화로 강제하지 않는다*(미관람작을 "보고 싶은 1순위"로 둘 수 있음 — 디자인 선택). 단 공개 투영(§5)에서는 본 영화만 노출 옵션 가능. `set_podium(rank, film_id)`(업서트)·`clear_podium(rank)`(삭제)는 멱등 mutator로 별도 제안(생략 — PK 업서트 패턴 그대로).

### 3.4 수용 테스트
- **유일성:** 1등에 영화 A를 두 번 set → 1행(업서트, 중복 안 생김).
- **충돌 해소:** A가 2등인데 1등으로 옮기면 → `unique(user_id, film_id)` 위반 없이 슬롯 이동(2등 비거나 swap 정책 명시).
- **안정:** `my_podium()` 2회 → 순서 동일.
- **빈 podium:** 0행 → 화면 "아직 순위 없음" placeholder, NaN 0건.

---

## 4. 동행 (slow-pair SNS) 싱크율

### 4.1 무엇을 만드나 / 무엇을 *소비*만 하나

동행 = **하루 한 명**의 무작위 상대와 묶여 *취향 싱크율*을 보는 slow-SNS. 싱크율 = 두 사용자 취향 벡터(①)의 코사인. **① 취향 벡터는 Phase 2가 만든다 — 여기선 그 출력 인터페이스만 소비**(01-taste-vector §7 계약: `{v_loved, confidence}` 제공). 실측: `user_taste_profile` 테이블 **아직 없음** → 동행은 ①이 적재되면 켜지는 *대기 기능*. 신원은 `profiles`(id·username·display_name·avatar_url)로 ground. **싱크율은 ①의 신뢰도를 상속**: 두 사람 중 하나라도 `taste_forming`(loved<8, Phase 2 §5)이면 코사인이 노이즈 → 숫자 대신 "형성 중"/신뢰 라벨로 노출(과신 금지).

### 4.2 결정적 일일 페어링 — Asia/Seoul 자정 (INTUITION-ORDER §F, STATE 패턴)

**약속:** "동행은 하루 단위로 바뀐다 · 자정 경계 = Asia/Seoul 고정." 두 사람이 *같은 한국 날짜*에는 **반드시 서로를 본다**(대칭), 그리고 **한국 자정에 정확히 회전**한다.

핵심 = **결정적 seed**: 페어는 저장하는 게 아니라 *그날에서 계산*한다 → 두 파트너가 같은 날 같은 결과를 독립 계산(서버 상태 불일치 불가).

```sql
-- 제안(PROPOSED). 오늘의 동행(KST). 저장 아님 — 그날의 결정적 매칭.
create or replace function public.todays_companion()
returns table(partner_id uuid, username text, display_name text, avatar_url text,
              seoul_day date, sync_pct int)
language sql stable security definer set search_path = public as $function$
  with me as (select auth.uid() as uid),
       day as (select (now() at time zone 'Asia/Seoul')::date as d),   -- ← KST 자정 경계
       -- 페어 풀: 활성·취향벡터 보유 유저 (① 적재 후). 결정적 정렬.
       pool as (
         select p.id,
                row_number() over (order by md5(p.id::text || (select d from day)::text)) as rn,
                count(*) over () as n
         from public.profiles p
         join public.user_taste_profile utp on utp.user_id = p.id   -- ① 보유자만(Phase 2)
         where p.account_status = 'active'
       ),
       -- 그날의 결정적 셔플에서 인접 짝을 만든다(짝수 인덱스 ↔ 다음).
       paired as (
         select a.id as a_id,
                b.id as b_id
         from pool a
         join pool b
           on b.rn = case when a.rn % 2 = 1 then a.rn + 1 else a.rn - 1 end
       ),
       mine as (
         select case when pr.a_id = (select uid from me) then pr.b_id
                     else pr.a_id end as partner_id
         from paired pr
         where (select uid from me) in (pr.a_id, pr.b_id)
       )
  select m.partner_id, p.username, coalesce(nullif(p.display_name,''), p.username),
         p.avatar_url,
         (select d from day) as seoul_day,
         -- 싱크율 = 두 v_loved 코사인 → 0..100 (①의 출력만 소비)
         round( 100 * greatest(0,
            1 - (utp_me.v_loved <=> utp_you.v_loved)        -- pgvector 코사인거리 → 유사도
         ) )::int as sync_pct
  from mine m
  join public.profiles p              on p.id = m.partner_id
  join public.user_taste_profile utp_me  on utp_me.user_id  = (select uid from me)
  join public.user_taste_profile utp_you on utp_you.user_id = m.partner_id;
$function$;
```

**왜 결정적·대칭·자정회전인가:**
- **seed = `md5(id || seoul_day)`** → 같은 KST 날짜면 풀 정렬이 *완전히 동일*. 짝수↔홀수 인접 페어링이라 A의 짝이 B면 **B의 짝도 반드시 A**(대칭 — 인접쌍의 상호성). 두 파트너가 독립 호출해도 같은 결과.
- **`(now() at time zone 'Asia/Seoul')::date`** → 한국 자정에 `seoul_day`가 바뀌는 *그 순간* 풀 정렬 seed가 바뀜 → 페어 회전. UTC·서버 로컬과 무관, INTUITION-ORDER §F "새벽에 두 명/안 바뀜" astonishment 차단.
- **저장 안 함** = STATE를 박제하지 않으니 "어제 짝이 캐시에 남는" 버그 불가. (단, 대화·반응을 남기려면 `(seoul_day, a_id, b_id)` 박제 테이블을 별도 제안 — 페어 *계산*은 위 함수가 진실원.)

홀수 인원: 마지막 1인은 짝 없음 → `todays_companion()` 0행 → "오늘은 동행이 쉬는 날"(빈 상태, NaN 0건).

### 4.3 가면무도회 — 부분 노출 규칙

동행은 *DM도 아니고 완전 공개도 아닌* 중간 상태("가면무도회"). 노출 등급을 못박는다:

| 노출 | 보임 | 안 보임 |
|---|---|---|
| **항상(가면)** | `display_name` 또는 `username`, `avatar_url`, **sync_pct**, 공통 앵커 상위 3(트로프/계보 *교집합만*) | 실명·이메일·전체 관람사·개별 평점·트로프 *전체* 분포 |
| **상대 동의 시(가면 벗기)** | 공개 프로필(§5 투영 그대로) 링크 | (그 이상은 없음 — §5가 상한) |

규칙:
- **싱크율과 *공통점*만 노출**(왜 통하는지) — 한쪽의 전체 취향은 안 보임. "두 분의 교집합: 무력한 목격자 · 이란 뉴웨이브"처럼 *교집합 앵커*만.
- **DM 아님:** 자유 텍스트 채널 없음(있다면 별도 모더레이션 설계 — Phase 4 범위 밖). delight 수준 = "오늘 누구와 통했나" 카드.
- **가면 벗기 = §5로 위임:** 더 보려면 상대의 *공개 프로필*로 — 즉 동행이 §5 투영보다 더 많은 걸 노출하지 않는다(상한 일치).

### 4.4 수용 테스트
- **대칭:** 같은 KST 날짜에 A가 본 partner = B면, B가 본 partner = A. (인접쌍 상호성.)
- **자정 회전:** `seoul_day`가 KST 23:59→00:00에 +1일 → 페어 변경. UTC 자정엔 *안* 바뀜.
- **결정적:** 같은 날 같은 유저로 2회 호출 → 동일 partner·동일 sync_pct.
- **빈 상태:** ① 미보유(Phase 2 전) 또는 홀수 잔여 1인 → 0행 → 빈 카드, NaN 0건.
- **상한:** 동행 카드가 §5 공개 투영보다 많은 필드를 절대 안 보임(트로프 전체 분포 유출 0).

---

## 5. 공개 프로필 투영 (public profile projection)

### 5.1 실측 — 기존 게이트가 이미 보수적

| RPC | 게이트(실측 소스) | 노출 |
|---|---|---|
| `public_portfolio(username)` | `portfolio_public AND um.seen AND um.visibility='public'` | 본·공개 영화 60편 + 정전가, 정전가순 |
| `public_portfolio_meta(username)` | `portfolio_public=false → NULL`(coalesce 가드) | username·display_name·bio·avatar·seen/watchlist/rated count·avg_prestige·nav |

`public_portfolio_meta`는 이미 **NaN-safe**: `portfolio_public`이 false면 통째로 `NULL` 반환(빈 프로필 렌더 가능), count·avg는 `visibility='public'` 부분집합에서만 집계 → 비공개 영화 0건 누출. **실명/이메일 컬럼은 애초에 SELECT 안 함**(`profiles`에 실명 컬럼 없음 — `display_name`은 사용자 설정 별칭). 실측: 현재 `portfolio_public=0`(4명 전원 비공개) → 두 RPC 모두 빈/NULL 반환이 정상 경로.

### 5.2 투영 규칙 — 화이트리스트(노출은 *명시 허용*만)

기준(prior design): **트로프·강한 오독(misreading)은 공개 금지 · 계보/커버리지/레벨/Standing 뱃지는 공개 · 실명 금지.** 화이트리스트로 못박는다(블랙리스트 금지 — 새 필드가 *기본 노출*되는 사고 방지):

| 엔진 산출 | 공개? | 게이트 | 근거 |
|---|---|---|---|
| 정전가(prestige)·NAV·avg_prestige | ✅ | `portfolio_public` | 객관 시장가 = 공유해도 사적이지 않음 |
| 레벨 밴드(⑧)·커버리지 %(⑦) | ✅ | `portfolio_public` | "도장깨기 성취" = 자랑거리 |
| 가치 뱃지(find/fit/over) | ✅(집계) | `portfolio_public` | 단, *개별 평점 숫자*는 비공개(뱃지만) |
| 계보 완파/커버리지 라인 | ✅ | `portfolio_public` | 성취 공개 |
| podium(§3) | ✅(옵션) | `portfolio_public` AND 본인 노출 토글 | "내 top 3" = 공유 의도 명확 |
| **트로프/형상 "내 코드"** | ❌ | — | 해석 = 사적, prior design 금지 |
| **강한 오독(takes·misreading)** | ❌ | — | 해석 레이어 비공개 |
| **취향 벡터·앵커 전체 분포** | ❌ | — | ①의 내부, 동행 교집합만 예외(§4.3) |
| **개별 평점·watched_at·note** | ❌ | — | `visibility` 무관하게 raw는 비공개 |
| **실명·이메일·country raw** | ❌ | — | `country`는 *집계/지역가용*에만, 프로필 표면 노출 안 함 |

### 5.3 제안 — 투영을 한 RPC로 합본(화이트리스트 강제)

```sql
-- 제안(PROPOSED). 공개 프로필 단일 투영. 화이트리스트 밖 필드는 *구조적으로* 못 나감.
create or replace function public.public_profile_projection(p_username text)
returns jsonb language sql stable security definer set search_path = public as $function$
  select case
    when p.id is null or coalesce(p.portfolio_public, false) = false then
      -- 비공개/없음: 최소 정보만(존재 여부조차 숨길지는 정책 — 여기선 null = "비공개")
      jsonb_build_object('public', false, 'username', p.username)
    else jsonb_build_object(
      'public',        true,
      'username',      p.username,
      'display_name',  coalesce(nullif(p.display_name,''), p.username),  -- 별칭만(실명 컬럼 없음)
      'avatar_url',    p.avatar_url,
      'bio',           p.bio,
      'reputation',    p.reputation,
      -- 집계 자산(화이트리스트): meta RPC 재사용 → 단일 소스
      'portfolio',     public.public_portfolio_meta(p_username),
      -- 커버리지/완파는 공개 — 단 *공개 영화* 부분집합 기반(별도 public 변형 RPC 필요)
      'note',          'lineage/level/standing 노출; trope·misreading·개별평점 비공개'
    )
  end
  from public.profiles p
  where p.username = p_username;
$function$;
```

> **설계 메모:** `public_portfolio_meta`를 재사용해 카운트/NAV 단일 소스를 유지. 커버리지 공개판은 `my_lineage_coverage()`의 *공개-영화 한정 변형*(`visibility='public'` 필터)이 필요 — 본인용 RPC를 그대로 공개에 쓰면 비공개 관람이 새므로 **별 RPC**(PROPOSED, 분모 동일·분자만 public). 트로프/오독/개별 평점은 이 함수가 *애초에 SELECT하지 않음* → 코드상 누출 경로 없음(화이트리스트의 힘).

### 5.4 수용 테스트
- **누출 0:** `public_profile_projection`이 반환하는 JSON 키에 trope·misreading·개별 rating·실명·email 키가 **0개**(화이트리스트라 구조적 보장).
- **비공개 안전:** `portfolio_public=false`(현재 4명 전원) → `{public:false, username}`만, NaN/에러 0건.
- **0편 안전:** 공개지만 0편 → count 0·avg `null`(coalesce)·nav 0, NaN 0건.
- **상한 일치:** 동행(§4) 가면 벗기로 가는 프로필 = 이 투영과 *정확히 동일*(더 많이 안 보임).

---

## 6. 적용·검증 순서 (전부 제안 — 승인 후)

1. **테이블 3종 생성**(제안): `user_lineage_milestone` · `user_podium` · (동행 대화 박제는 선택). RLS 본인 한정.
2. **RPC 5종**(제안): `fire_lineage_milestones()` · `my_undervalued()` · `my_podium()`(+`set/clear`) · `todays_companion()` · `public_profile_projection()` + 커버리지 공개판.
3. **선행 의존:** §1·§2는 Phase 1(`my_lineage_coverage()`·정전가 v2)이 먼저. §4는 **Phase 2의 ①(`user_taste_profile`)**이 먼저 — 그전엔 `todays_companion()` 0행(대기 기능).
4. **멱등 단위테스트:** `fire_lineage_milestones()` 2회 호출 → 2회차 0행. `set_podium` 동일 슬롯 2회 → 1행.
5. **시간 단위테스트:** `todays_companion()`를 KST 23:59 / 00:01 모킹 → `seoul_day` ±1·페어 회전. 두 파트너 독립 호출 대칭.
6. **누출 회귀:** `public_profile_projection` JSON 키 화이트리스트 대조(trope/rating/실명 0건).
7. **콜드스타트:** 0편·비공개·① 미보유 각각에서 NaN/빈 에러 0건.

DB는 이 문서 작성 시점까지 **미수정** — 모든 SQL은 제안.

---

## 7. Phase 4가 닫는 것 / 경계

**닫음(delight, 신뢰 비필수):** 완파 축포가 *정확히 한 번*(멱등 PK) · 발굴 정렬이 *낮은 별점을 절대 안 올림*(rating 게이트) · podium이 *재로드에 안 흔들림*(명시 rank + tie-break) · 동행이 *KST 자정에 대칭 회전*(결정적 md5 seed) · 공개 프로필이 *화이트리스트 밖을 구조적으로 못 내보냄*.

**경계(범위 밖, 명시):** ① 취향 벡터 *생성*(Phase 2) · 동행 자유 텍스트/모더레이션 · podium swap UX 세부 · 완파 알림 푸시 전달(클라이언트). Phase 4는 *백엔드 로직·저장·게이트*까지.

---

## 8b. UX 역반영 (2026-06 직관화 패스 · `docs/ux/SHARED-STANDARD.md`)

- **완파 4-상태**(잠금<50 / 진행50–74 / 근접75–99 / 완파100) = `fire_lineage_milestones`(50/75/100 임계)와 표시 정합. command-center·analysis·profile 공통 어휘.
- **공개 투영 visibility 통합**(C7): item-level(`user_movies.visibility`) + section-level(`portfolio_public` 화이트리스트). 토글 UI는 공유 pill, **투영은 §5 `public_profile_projection`/뷰에서 강제**(프런트 가림은 보조). `set_visibility(target, public|private)` RPC(멱등).

---

*Phase 4 = 신뢰의 척추(0–3) 위에 얹는 결. 화려하지만, 그 화려함조차 예측가능성을 어기지 않는다 — 축포는 한 번, 짝은 자정에, 비공개는 비공개로.*
