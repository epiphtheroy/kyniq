-- 0096_wtw_redesign.sql
-- What to Watch ("The Marquee") redesign: richer sorting + multi-genre + rent-inclusive
-- availability, a labeled services directory, and per-user saved views.
--
-- (Applied to production 2026-07-13 via worker/apply-sql.py.)
--
-- Changes:
--   1. cinecodex_ranked v11 / cinecodex_ranked_mine v11 — append p_genres text[],
--      p_dir text ('asc'|'desc'), p_include_rent boolean; add sorts 'director'/'country';
--      emit director_slug in each row (for card director links). Defaults reproduce v10
--      exactly, so the Screener and existing /what-to-watch calls are unaffected.
--   2. wtw_services(p_country, p_per_group) — labeled provider directory (subscription /
--      free / rent) that INCLUDES YouTube + rent stores + a library flag (Kanopy/Hoopla).
--   3. wtw_saved_views — logged-in users' named filter/sort presets (RLS: own-row).
--
-- INVARIANTS: overload-trap (drop old sig first, re-grant); rent/buy still excluded from
-- the availability match UNLESS p_include_rent (a user who picked YouTube wants rentables);
-- anon 8s statement_timeout; _mine stays service_role only.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1a. cinecodex_ranked v11
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.cinecodex_ranked(text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, integer, integer, text[], boolean);

create function public.cinecodex_ranked(
  p_sort text default 'u', p_lambda numeric default 1.0, p_q text default null,
  p_year_min integer default null, p_year_max integer default null, p_country text default null,
  p_max_cost numeric default 100, p_sub jsonb default '{}'::jsonb,
  p_ts_min numeric default null, p_ts_max numeric default null,
  p_providers integer[] default null, p_watch_country text default null,
  p_max_votes integer default null, p_genre text default null,
  p_limit integer default 60, p_offset integer default 0,
  p_watch_countries text[] default null, p_include_us_library boolean default false,
  p_genres text[] default null, p_dir text default null, p_include_rent boolean default false)
 returns json language sql stable security definer
 set search_path to 'public', 'cinecodex', 'curation' set statement_timeout to '8s'
as $function$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.c_cost, s.r_risk,
      s.cog, s.aff, s.form, s.moral, s.dur, s.itx, s.fr, s.etx, s.ctx,
      s.bank, s.insincere, s.coward, s.polar
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  base as (
    select f.slug, f.title, f.year, f.poster_path, f.director, f.director_slug,
           round(b.v_value,1) v, round(b.c_cost,1) c, round(b.r_risk,1) r,
           round(b.v_value - p_lambda*b.r_risk,1) u,
           round((b.v_value-50)/greatest(b.r_risk,1),2) sharpe,
           cf.country_code, rt.imdb_rating, rt.imdb_votes, rt.rt_tomatometer as rt
    from best b
    join public.films f on f.id=b.film_id
    left join curation.film cf on cf.tmdb_id=f.tmdb_id
    left join public.film_ratings rt on rt.film_id = f.id
    where b.c_cost <= p_max_cost
      and (p_q is null or p_q='' or f.title ilike '%'||p_q||'%')
      and (p_year_min is null or f.year >= p_year_min)
      and (p_year_max is null or f.year <= p_year_max)
      and (p_country is null or p_country='' or cf.country_code = p_country)
      and (p_genre is null or p_genre='' or p_genre = any(f.genres))
      and (p_genres is null or coalesce(array_length(p_genres,1),0)=0 or f.genres && p_genres)
      and (p_max_votes is null or coalesce(rt.imdb_votes,0) <= p_max_votes)
      and (
        not ( (p_providers is not null and coalesce(array_length(p_providers,1),0) > 0) or p_include_us_library )
        or exists (
          select 1 from public.film_provider_index x
          where x.film_id = f.id
            and (
              ( p_providers is not null and x.provider_id = any(p_providers)
                and (p_include_rent or x.kind not in ('rent','buy'))
                and x.country_code = any(coalesce(p_watch_countries, array[upper(coalesce(p_watch_country,''))])) )
              or ( p_include_us_library and x.country_code = 'US' and x.provider_id in (191,212) and x.kind not in ('rent','buy') )
            )
        )
      )
      and (p_sub->'cog'       is null or b.cog       between coalesce((p_sub->'cog'->>'min')::int,0)       and coalesce((p_sub->'cog'->>'max')::int,100))
      and (p_sub->'aff'       is null or b.aff       between coalesce((p_sub->'aff'->>'min')::int,0)       and coalesce((p_sub->'aff'->>'max')::int,100))
      and (p_sub->'form'      is null or b.form      between coalesce((p_sub->'form'->>'min')::int,0)      and coalesce((p_sub->'form'->>'max')::int,100))
      and (p_sub->'moral'     is null or b.moral     between coalesce((p_sub->'moral'->>'min')::int,0)     and coalesce((p_sub->'moral'->>'max')::int,100))
      and (p_sub->'dur'       is null or b.dur       between coalesce((p_sub->'dur'->>'min')::int,0)       and coalesce((p_sub->'dur'->>'max')::int,100))
      and (p_sub->'itx'       is null or b.itx       between coalesce((p_sub->'itx'->>'min')::int,0)       and coalesce((p_sub->'itx'->>'max')::int,100))
      and (p_sub->'fr'        is null or b.fr        between coalesce((p_sub->'fr'->>'min')::int,0)        and coalesce((p_sub->'fr'->>'max')::int,100))
      and (p_sub->'etx'       is null or b.etx       between coalesce((p_sub->'etx'->>'min')::int,0)       and coalesce((p_sub->'etx'->>'max')::int,100))
      and (p_sub->'ctx'       is null or b.ctx       between coalesce((p_sub->'ctx'->>'min')::int,0)       and coalesce((p_sub->'ctx'->>'max')::int,100))
      and (p_sub->'bank'      is null or b.bank      between coalesce((p_sub->'bank'->>'min')::int,0)      and coalesce((p_sub->'bank'->>'max')::int,100))
      and (p_sub->'insincere' is null or b.insincere between coalesce((p_sub->'insincere'->>'min')::int,0) and coalesce((p_sub->'insincere'->>'max')::int,100))
      and (p_sub->'coward'    is null or b.coward    between coalesce((p_sub->'coward'->>'min')::int,0)    and coalesce((p_sub->'coward'->>'max')::int,100))
      and (p_sub->'polar'     is null or b.polar     between coalesce((p_sub->'polar'->>'min')::int,0)     and coalesce((p_sub->'polar'->>'max')::int,100))
  ),
  tsfiltered as (
    select * from base where (p_ts_min is null or u >= p_ts_min) and (p_ts_max is null or u <= p_ts_max)
  ),
  ordered as (
    select tf.*, row_number() over (
      order by
        (case when p_sort in ('alpha','director','country') then null::numeric
              else (case p_sort when 'v' then v when 'c' then -c when 'r' then -r
                      when 'sharpe' then sharpe when 'lowrisk' then -r
                      when 'newest' then year when 'oldest' then -year else u end) end)
          * (case when p_dir='asc' then -1 else 1 end) desc nulls last,
        (case when p_sort in ('alpha','director','country') and coalesce(p_dir,'asc') <> 'desc'
              then (case p_sort when 'director' then lower(director) when 'country' then country_code else lower(title) end)
              else null end) asc nulls last,
        (case when p_sort in ('alpha','director','country') and p_dir='desc'
              then (case p_sort when 'director' then lower(director) when 'country' then country_code else lower(title) end)
              else null end) desc nulls last,
        slug) as rank
    from tsfiltered tf
  )
  select json_build_object(
    'total', (select count(*) from tsfiltered),
    'rows', coalesce((select json_agg(x) from (
        select * from ordered order by rank limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::json)
  );
$function$;

grant execute on function public.cinecodex_ranked(text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, integer, integer, text[], boolean, text[], text, boolean) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1b. cinecodex_ranked_mine v11
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.cinecodex_ranked_mine(uuid, text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, text, integer, integer, text[], boolean);

create function public.cinecodex_ranked_mine(
  p_user uuid, p_sort text default 'u', p_lambda numeric default 1.0, p_q text default null,
  p_year_min integer default null, p_year_max integer default null, p_country text default null,
  p_max_cost numeric default 100, p_sub jsonb default '{}'::jsonb,
  p_ts_min numeric default null, p_ts_max numeric default null,
  p_providers integer[] default null, p_watch_country text default null,
  p_max_votes integer default null, p_mode text default 'only', p_genre text default null,
  p_limit integer default 60, p_offset integer default 0,
  p_watch_countries text[] default null, p_include_us_library boolean default false,
  p_genres text[] default null, p_dir text default null, p_include_rent boolean default false)
 returns json language sql stable security definer
 set search_path to 'public', 'cinecodex', 'curation' set statement_timeout to '8s'
as $function$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.c_cost, s.r_risk,
      s.cog, s.aff, s.form, s.moral, s.dur, s.itx, s.fr, s.etx, s.ctx,
      s.bank, s.insincere, s.coward, s.polar
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  base as (
    select f.slug, f.title, f.year, f.poster_path, f.director, f.director_slug,
           round(b.v_value,1) v, round(b.c_cost,1) c, round(b.r_risk,1) r,
           round(b.v_value - p_lambda*b.r_risk,1) u,
           round((b.v_value-50)/greatest(b.r_risk,1),2) sharpe,
           cf.country_code, rt.imdb_rating, rt.imdb_votes, rt.rt_tomatometer as rt
    from best b
    join public.films f on f.id=b.film_id
    left join curation.film cf on cf.tmdb_id=f.tmdb_id
    left join public.film_ratings rt on rt.film_id = f.id
    where b.c_cost <= p_max_cost
      and (case when p_mode='exclude'
                then not exists (select 1 from public.user_movies um where um.film_id=f.id and um.user_id=p_user and um.seen)
                else     exists (select 1 from public.user_movies um where um.film_id=f.id and um.user_id=p_user and um.seen) end)
      and (p_q is null or p_q='' or f.title ilike '%'||p_q||'%')
      and (p_year_min is null or f.year >= p_year_min)
      and (p_year_max is null or f.year <= p_year_max)
      and (p_country is null or p_country='' or cf.country_code = p_country)
      and (p_genre is null or p_genre='' or p_genre = any(f.genres))
      and (p_genres is null or coalesce(array_length(p_genres,1),0)=0 or f.genres && p_genres)
      and (p_max_votes is null or coalesce(rt.imdb_votes,0) <= p_max_votes)
      and (
        not ( (p_providers is not null and coalesce(array_length(p_providers,1),0) > 0) or p_include_us_library )
        or exists (
          select 1 from public.film_provider_index x
          where x.film_id = f.id
            and (
              ( p_providers is not null and x.provider_id = any(p_providers)
                and (p_include_rent or x.kind not in ('rent','buy'))
                and x.country_code = any(coalesce(p_watch_countries, array[upper(coalesce(p_watch_country,''))])) )
              or ( p_include_us_library and x.country_code = 'US' and x.provider_id in (191,212) and x.kind not in ('rent','buy') )
            )
        )
      )
      and (p_sub->'cog'       is null or b.cog       between coalesce((p_sub->'cog'->>'min')::int,0)       and coalesce((p_sub->'cog'->>'max')::int,100))
      and (p_sub->'aff'       is null or b.aff       between coalesce((p_sub->'aff'->>'min')::int,0)       and coalesce((p_sub->'aff'->>'max')::int,100))
      and (p_sub->'form'      is null or b.form      between coalesce((p_sub->'form'->>'min')::int,0)      and coalesce((p_sub->'form'->>'max')::int,100))
      and (p_sub->'moral'     is null or b.moral     between coalesce((p_sub->'moral'->>'min')::int,0)     and coalesce((p_sub->'moral'->>'max')::int,100))
      and (p_sub->'dur'       is null or b.dur       between coalesce((p_sub->'dur'->>'min')::int,0)       and coalesce((p_sub->'dur'->>'max')::int,100))
      and (p_sub->'itx'       is null or b.itx       between coalesce((p_sub->'itx'->>'min')::int,0)       and coalesce((p_sub->'itx'->>'max')::int,100))
      and (p_sub->'fr'        is null or b.fr        between coalesce((p_sub->'fr'->>'min')::int,0)        and coalesce((p_sub->'fr'->>'max')::int,100))
      and (p_sub->'etx'       is null or b.etx       between coalesce((p_sub->'etx'->>'min')::int,0)       and coalesce((p_sub->'etx'->>'max')::int,100))
      and (p_sub->'ctx'       is null or b.ctx       between coalesce((p_sub->'ctx'->>'min')::int,0)       and coalesce((p_sub->'ctx'->>'max')::int,100))
      and (p_sub->'bank'      is null or b.bank      between coalesce((p_sub->'bank'->>'min')::int,0)      and coalesce((p_sub->'bank'->>'max')::int,100))
      and (p_sub->'insincere' is null or b.insincere between coalesce((p_sub->'insincere'->>'min')::int,0) and coalesce((p_sub->'insincere'->>'max')::int,100))
      and (p_sub->'coward'    is null or b.coward    between coalesce((p_sub->'coward'->>'min')::int,0)    and coalesce((p_sub->'coward'->>'max')::int,100))
      and (p_sub->'polar'     is null or b.polar     between coalesce((p_sub->'polar'->>'min')::int,0)     and coalesce((p_sub->'polar'->>'max')::int,100))
  ),
  tsfiltered as (
    select * from base where (p_ts_min is null or u >= p_ts_min) and (p_ts_max is null or u <= p_ts_max)
  ),
  ordered as (
    select tf.*, row_number() over (
      order by
        (case when p_sort in ('alpha','director','country') then null::numeric
              else (case p_sort when 'v' then v when 'c' then -c when 'r' then -r
                      when 'sharpe' then sharpe when 'lowrisk' then -r
                      when 'newest' then year when 'oldest' then -year else u end) end)
          * (case when p_dir='asc' then -1 else 1 end) desc nulls last,
        (case when p_sort in ('alpha','director','country') and coalesce(p_dir,'asc') <> 'desc'
              then (case p_sort when 'director' then lower(director) when 'country' then country_code else lower(title) end)
              else null end) asc nulls last,
        (case when p_sort in ('alpha','director','country') and p_dir='desc'
              then (case p_sort when 'director' then lower(director) when 'country' then country_code else lower(title) end)
              else null end) desc nulls last,
        slug) as rank
    from tsfiltered tf
  )
  select json_build_object(
    'total', (select count(*) from tsfiltered),
    'rows', coalesce((select json_agg(x) from (
        select * from ordered order by rank limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::json)
  );
$function$;

revoke all on function public.cinecodex_ranked_mine(uuid, text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, text, integer, integer, text[], boolean, text[], text, boolean) from anon, authenticated, public;
grant execute on function public.cinecodex_ranked_mine(uuid, text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, text, integer, integer, text[], boolean, text[], text, boolean) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. wtw_services() — labeled provider directory (subscription / free / rent),
--    INCLUDES YouTube + rent stores, flags library (Kanopy/Hoopla). Top-N per group.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.wtw_services(p_country text, p_per_group int default 24)
 returns json language sql stable security definer
 set search_path to 'public' set statement_timeout to '8s'
as $function$
  with per as (
    select provider_id,
           min(provider_name) as provider_name,
           min(provider_logo) as provider_logo,
           array_agg(distinct kind order by kind)                        as kinds,
           count(distinct film_id) filter (where kind = 'flatrate')      as sub_n,
           count(distinct film_id) filter (where kind in ('free','ads')) as free_n,
           count(distinct film_id) filter (where kind in ('rent','buy')) as rent_n,
           count(distinct film_id)::int                                  as n
    from public.film_provider_index
    where country_code = upper(coalesce(p_country,''))
    group by provider_id
  ),
  labeled as (
    -- A service is 'subscription' if it has a MEANINGFUL flatrate catalog (>=30 films)
    -- or flatrate is its dominant tier — this keeps wavve/Prime (sub + heavy rent) in
    -- Subscription where a subscriber looks, while YouTube (sub_n=0) falls to Rent and
    -- Kanopy/Hoopla (tiny flatrate, huge free) fall to Free.
    select *,
           case
             when sub_n >= 30 or (sub_n > 0 and sub_n >= greatest(free_n, rent_n)) then 'subscription'
             when free_n >= rent_n and free_n > 0 then 'free'
             else 'rent'
           end                        as label,
           (provider_id in (191,212)) as library
    from per
  ),
  ranked as (
    select *, row_number() over (partition by label order by n desc, provider_name) as rk
    from labeled
  )
  select coalesce(json_agg(json_build_object(
           'provider_id',   provider_id,
           'provider_name', provider_name,
           'logo_path',     provider_logo,
           'kinds',         kinds,
           'label',         label,
           'library',       library,
           'n',             n)
         order by case label when 'subscription' then 0 when 'free' then 1 else 2 end, n desc, provider_name), '[]'::json)
  from ranked
  where rk <= p_per_group;
$function$;

grant execute on function public.wtw_services(text, int) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. wtw_saved_views — logged-in users' named filter/sort presets (own-row RLS).
--    CRUD flows through /api/wtw/views (service_role, scoped to auth.uid()).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.wtw_saved_views (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wtw_saved_views_user on public.wtw_saved_views (user_id, created_at desc);
-- plain (user_id, name) so POST can upsert on_conflict "user_id,name" (re-saving a name overwrites).
create unique index if not exists wtw_saved_views_user_name on public.wtw_saved_views (user_id, name);

alter table public.wtw_saved_views enable row level security;

drop policy if exists "wtw views own select" on public.wtw_saved_views;
create policy "wtw views own select" on public.wtw_saved_views for select using (auth.uid() = user_id);
drop policy if exists "wtw views own insert" on public.wtw_saved_views;
create policy "wtw views own insert" on public.wtw_saved_views for insert with check (auth.uid() = user_id);
drop policy if exists "wtw views own update" on public.wtw_saved_views;
create policy "wtw views own update" on public.wtw_saved_views for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wtw views own delete" on public.wtw_saved_views;
create policy "wtw views own delete" on public.wtw_saved_views for delete using (auth.uid() = user_id);
