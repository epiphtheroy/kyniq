-- 0031 — 동행(pair · 가면무도회) 실구현 (ROOM-HANDOVER-MASTER §8 P1-7, LOGIC-AUDIT §5)
-- 설계 원칙 (부분노출을 프론트가 아닌 RPC 레벨에서 강제):
--  · pair_matches는 RLS enable + 정책 0 (default-deny) — 파트너 uuid가 PostgREST로 직접 노출되지 않음.
--  · me_today_pair()가 반환하는 것 = 싱크율 · 교집합 앵커 · 공통 계보 · 동의 상태뿐.
--    실명/사진/개별 평점/전체 취향/파트너 uuid는 절대 미반환.
--  · 「가면 벗기」 = 상호 동의(consent both) + 상대 portfolio_public일 때만 공개 프로필 username 공개.
--  · 매칭 = 일자별 결정적 페어링: eligible 유저를 md5(day||uid)로 정렬해 인접쌍(1↔2, 3↔4…).
--    양방향 일관(A의 상대가 B면 B의 상대도 A), 홀수면 마지막 1명은 오늘 휴장(정직 empty).
--  · eligibility = loved(★4.5+) ≥ 8 (taste_forming 배제) — 형성 중이면 하드 숫자 대신 형성 상태 반환.
--  · 싱크율 = 두 사람 loved 취향 벡터(centroid) 코사인 × 100. 벡터 표본(<3편) 부족 시 null(합성 금지).

create table if not exists public.pair_matches (
  day             date not null,
  user_a          uuid not null references public.profiles(id) on delete cascade,
  user_b          uuid not null references public.profiles(id) on delete cascade,
  sync_pct        numeric,
  shared_anchors  jsonb not null default '[]'::jsonb,
  shared_lineages jsonb not null default '[]'::jsonb,
  consent_a       boolean not null default false,
  consent_b       boolean not null default false,
  created_at      timestamptz not null default now(),
  primary key (day, user_a, user_b),
  check (user_a < user_b)
);

-- default-deny: RLS on · 정책 0 — 접근은 아래 DEFINER RPC로만 (film_taste_vector와 동일 패턴)
alter table public.pair_matches enable row level security;

create or replace function public.me_today_pair()
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_loved int; v_forming boolean;
  v_eligible int; v_my_rn int; v_partner uuid; v_n int;
  v_a uuid; v_b uuid; v_row pair_matches%rowtype;
  v_sync numeric; v_anchors jsonb; v_lineages jsonb;
  v_my_consent boolean; v_partner_consent boolean; v_revealed json;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select count(*) into v_loved from user_movies um
  where um.user_id = v_uid and um.seen and um.rating >= 4.5;
  v_forming := v_loved < 8;

  -- eligible = loved ≥8 유저를 md5(day||uid)로 결정적 정렬 (매일 회전, 양방향 일관)
  with elig as (
    select um.user_id from user_movies um
    where um.seen and um.rating >= 4.5
    group by um.user_id having count(*) >= 8
  ),
  ranked as (
    select user_id,
           row_number() over (order by md5(current_date::text || user_id::text)) rn,
           count(*) over () n
    from elig
  )
  select r.rn, r.n into v_my_rn, v_n from ranked r where r.user_id = v_uid;

  if v_my_rn is null then
    select count(*) into v_eligible
    from (select um.user_id from user_movies um
          where um.seen and um.rating >= 4.5
          group by um.user_id having count(*) >= 8) e;
    return json_build_object(
      'has_partner', false, 'reason', case when v_forming then 'forming' else 'ineligible' end,
      'loved_n', v_loved, 'forming', v_forming,
      'candidates', coalesce(v_eligible, 0));
  end if;
  v_eligible := v_n;

  -- 인접쌍: 홀수 rn → rn+1, 짝수 rn → rn−1 (양방향 일관)
  with elig as (
    select um.user_id from user_movies um
    where um.seen and um.rating >= 4.5
    group by um.user_id having count(*) >= 8
  ),
  ranked as (
    select user_id,
           row_number() over (order by md5(current_date::text || user_id::text)) rn
    from elig
  )
  select r.user_id into v_partner from ranked r
  where r.rn = case when v_my_rn % 2 = 1 then v_my_rn + 1 else v_my_rn - 1 end;

  if v_partner is null then
    return json_build_object(
      'has_partner', false, 'reason', 'odd_out',
      'loved_n', v_loved, 'forming', v_forming,
      'candidates', greatest(v_eligible - 1, 0));
  end if;

  v_a := least(v_uid, v_partner); v_b := greatest(v_uid, v_partner);

  select * into v_row from pair_matches pm
  where pm.day = current_date and pm.user_a = v_a and pm.user_b = v_b;

  if v_row.day is null then
    -- 싱크율: 두 사람 loved(★4.5+) 취향 centroid 코사인 (표본 <3편이면 null — 합성 금지)
    with av as (
      select l2_normalize(avg(ftv.embedding)) v, count(*) n
      from user_movies um join film_taste_vector ftv on ftv.film_id = um.film_id
      where um.user_id = v_a and um.seen and um.rating >= 4.5
    ), bv as (
      select l2_normalize(avg(ftv.embedding)) v, count(*) n
      from user_movies um join film_taste_vector ftv on ftv.film_id = um.film_id
      where um.user_id = v_b and um.seen and um.rating >= 4.5
    )
    select case when av.n >= 3 and bv.n >= 3
                then round(greatest(0, least(100, 100 * (1 - (av.v <=> bv.v)))))
                else null end
    into v_sync from av, bv;

    -- 교집합 앵커: 두 사람 loved를 모두 가로지르는 figure_type(트로프) 상위 4 (라벨만)
    with a_loved as (select film_id from user_movies where user_id = v_a and seen and rating >= 4.5),
    b_loved as (select film_id from user_movies where user_id = v_b and seen and rating >= 4.5),
    a_t as (
      select mt.id, mt.title, count(distinct fg.film_id) n
      from a_loved al join figures fg on fg.film_id = al.film_id
      join figure_type_members ftm on ftm.figure_id = fg.id
      join meta_takes mt on mt.id = ftm.meta_take_id and mt.kind = 'figure_type' and mt.status = 'published'
      group by mt.id, mt.title
    ),
    b_t as (
      select mt.id, count(distinct fg.film_id) n
      from b_loved bl join figures fg on fg.film_id = bl.film_id
      join figure_type_members ftm on ftm.figure_id = fg.id
      join meta_takes mt on mt.id = ftm.meta_take_id and mt.kind = 'figure_type' and mt.status = 'published'
      group by mt.id
    )
    select coalesce(jsonb_agg(jsonb_build_object('label', x.title, 'films', x.tot) order by x.tot desc), '[]'::jsonb)
    into v_anchors
    from (select a_t.title, a_t.n + b_t.n tot from a_t join b_t on b_t.id = a_t.id
          order by a_t.n + b_t.n desc limit 4) x;

    -- 공통 계보: 두 사람 모두 관람 발자국이 있는 계보 상위 3 (제목만)
    with a_seen as (select film_id from user_movies where user_id = v_a and seen),
    b_seen as (select film_id from user_movies where user_id = v_b and seen),
    a_l as (select fl.list_id, count(distinct fl.film_id) n from film_lineage fl join a_seen s on s.film_id = fl.film_id group by fl.list_id),
    b_l as (select fl.list_id, count(distinct fl.film_id) n from film_lineage fl join b_seen s on s.film_id = fl.film_id group by fl.list_id)
    select coalesce(jsonb_agg(jsonb_build_object('label', x.label, 'films', x.tot) order by x.tot desc), '[]'::jsonb)
    into v_lineages
    from (select ll.label, a_l.n + b_l.n tot
          from a_l join b_l on b_l.list_id = a_l.list_id
          join lineage_lists ll on ll.id = a_l.list_id and ll.status = 'active'
          order by a_l.n + b_l.n desc limit 3) x;

    insert into pair_matches (day, user_a, user_b, sync_pct, shared_anchors, shared_lineages)
    values (current_date, v_a, v_b, v_sync, v_anchors, v_lineages)
    on conflict (day, user_a, user_b) do nothing;

    select * into v_row from pair_matches pm
    where pm.day = current_date and pm.user_a = v_a and pm.user_b = v_b;
  end if;

  v_my_consent      := case when v_uid = v_row.user_a then v_row.consent_a else v_row.consent_b end;
  v_partner_consent := case when v_uid = v_row.user_a then v_row.consent_b else v_row.consent_a end;

  -- 가면 벗기: 상호 동의 시에만, 상대의 "공개 프로필"만 (portfolio_public 아닐 땐 공개 불가 명시)
  v_revealed := null;
  if v_row.consent_a and v_row.consent_b then
    select json_build_object('username', p.username, 'display_name', p.display_name)
    into v_revealed
    from profiles p where p.id = v_partner and p.portfolio_public = true and p.username is not null;
    if v_revealed is null then v_revealed := json_build_object('public', false); end if;
  end if;

  return json_build_object(
    'has_partner', true,
    'sync_pct', v_row.sync_pct,
    'shared_anchors', v_row.shared_anchors,
    'shared_lineages', v_row.shared_lineages,
    'my_consent', v_my_consent,
    'partner_consent', v_partner_consent,
    'revealed', v_revealed,
    'loved_n', v_loved, 'forming', v_forming,
    'candidates', greatest(v_eligible - 1, 0));
end;
$$;

-- 「가면 벗기」 동의 — 내 쪽 consent만 기록, 갱신된 상태 반환
create or replace function public.me_pair_reveal()
returns json
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); j json;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  j := public.me_today_pair();            -- 오늘 매치 보장(없으면 생성)
  if not (j->>'has_partner')::boolean then return j; end if;
  update pair_matches pm set
    consent_a = case when pm.user_a = v_uid then true else pm.consent_a end,
    consent_b = case when pm.user_b = v_uid then true else pm.consent_b end
  where pm.day = current_date and (pm.user_a = v_uid or pm.user_b = v_uid);
  return public.me_today_pair();
end;
$$;

-- 지난 동행 히스토리 — 부분노출 보존(싱크율·최상위 교집합 앵커만, 상대 정보 없음)
create or replace function public.me_pair_history(p_days int default 7)
returns table(day date, sync_pct numeric, top_anchor text)
language sql stable security definer
set search_path = public
as $$
  select pm.day, pm.sync_pct, pm.shared_anchors->0->>'label'
  from pair_matches pm
  where (pm.user_a = auth.uid() or pm.user_b = auth.uid())
    and pm.day >= current_date - greatest(p_days, 1)
  order by pm.day desc;
$$;
