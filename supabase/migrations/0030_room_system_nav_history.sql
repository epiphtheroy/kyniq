-- 0030 — 셸 시스템상태 실데이터 + NAV 자산곡선 (ROOM-HANDOVER-MASTER §8 P0-5, P1-6)
--  me_system_status(): 티커/시스템카드 하드코딩(6,701편·v2-fixA·Vertigo 84.5) 제거용 실측 스냅샷.
--  nav_snapshots + me_nav_history(): 데스크 자산곡선의 정직한 데이터 기반.
--    NAV 단조 불변식 — 관람은 NAV를 깎지 않는다. 스냅샷은 seen 변화 시점(rate_film·me_mark_seen)에만
--    적재되고, NAV 공식 자체가 관람 추가에 단조라 곡선은 비하락이다.

-- ── 시스템 상태 (공개 집계만 — 개인 데이터 없음) ──
create or replace function public.me_system_status()
returns json
language sql stable security definer
set search_path = public, cinecodex
as $$
  select json_build_object(
    'scored_films',  (select count(distinct film_id) from cinecodex.scores),
    'model_version', (select fs.model_version from film_scores fs order by fs.computed_at desc nulls last limit 1),
    'standing_last', (select to_char(max(fs2.computed_at), 'YYYY-MM-DD') from film_scores fs2),
    'taste_vectors', (select count(*) from film_taste_vector),
    'films_visible', (select count(*) from films where visible),
    'locations',     (select count(*) from film_locations where lat is not null),
    'top_film',      (select json_build_object('title', f.title, 'prestige', round(fs3.prestige_score, 1))
                      from film_scores fs3 join films f on f.id = fs3.film_id
                      where f.visible order by fs3.prestige_score desc nulls last limit 1)
  );
$$;

-- ── NAV 스냅샷 (개인 · RLS: 본인 읽기 전용, 쓰기는 DEFINER RPC 경유만) ──
create table if not exists public.nav_snapshots (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null default current_date,
  nav        numeric,
  n_watched  integer,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.nav_snapshots enable row level security;

drop policy if exists nav_snapshots_read_own on public.nav_snapshots;
create policy nav_snapshots_read_own on public.nav_snapshots
  for select using (auth.uid() = user_id);

-- ── 스냅샷 적재 헬퍼 (seen 변화 시점에 호출) ──
create or replace function public.me_snapshot_nav()
returns void
language plpgsql security definer
set search_path = public
as $$
declare j json;
begin
  if auth.uid() is null then return; end if;
  j := public.me_portfolio_nav();
  insert into nav_snapshots (user_id, day, nav, n_watched)
  values (auth.uid(), current_date, (j->>'nav')::numeric, (j->>'n_watched')::int)
  on conflict (user_id, day) do update
    set nav = excluded.nav, n_watched = excluded.n_watched, created_at = now();
end;
$$;

-- ── 자산곡선: 과거 스냅샷 + 오늘 라이브 NAV (합성 없음 — 실측만) ──
create or replace function public.me_nav_history(p_days int default 180)
returns table(day date, nav numeric, n_watched integer)
language sql stable security definer
set search_path = public
as $$
  with live as (select public.me_portfolio_nav() j)
  select t.day, t.nav, t.n_watched from (
    select s.day, s.nav, s.n_watched
    from nav_snapshots s
    where s.user_id = auth.uid()
      and s.day < current_date
      and s.day >= current_date - greatest(p_days, 1)
    union all
    select current_date, (l.j->>'nav')::numeric, (l.j->>'n_watched')::int from live l
  ) t
  order by t.day;
$$;

-- ── rate_film 재정의: 평가(=자동 봤어요) 시 NAV 스냅샷 적재 (시그니처·의미 불변) ──
create or replace function public.rate_film(p_slug text, p_rating numeric)
returns table(slug text, rating numeric, loved boolean, seen boolean)
language plpgsql security definer
set search_path = public
as $$
declare v_film uuid; v_uid uuid := auth.uid(); v_r numeric;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  -- clamp to 0.5–5 half-star grid
  v_r := round((least(5, greatest(0.5, p_rating)) * 2)) / 2.0;
  select id into v_film from films where films.slug = p_slug;
  if v_film is null then raise exception 'film not found: %', p_slug; end if;
  insert into user_movies (user_id, film_id, rating, seen, watched_at, added_at)
  values (v_uid, v_film, v_r, true, current_date, now())
  on conflict (user_id, film_id) do update
    set rating = excluded.rating, seen = true,
        watched_at = coalesce(user_movies.watched_at, current_date),
        added_at = now();
  perform public.me_snapshot_nav();
  return query select p_slug, v_r, (v_r >= 4.5), true;
end;
$$;

-- ── me_mark_seen 재정의: 스냅샷 적재 추가 (0028 정의 위에 덮음) ──
create or replace function public.me_mark_seen(p_slug text)
returns table(slug text, seen boolean)
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_film uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select id into v_film from films f where f.slug = p_slug;
  if v_film is null then raise exception 'film not found: %', p_slug; end if;
  insert into user_movies (user_id, film_id, seen, watched_at, added_at)
  values (v_uid, v_film, true, current_date, now())
  on conflict (user_id, film_id) do update
    set seen = true,
        watched_at = coalesce(user_movies.watched_at, current_date),
        dismissed = false;
  perform public.me_snapshot_nav();
  return query select p_slug, true;
end;
$$;
