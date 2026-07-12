-- 0095_marquee_availability.sql
-- What to Watch ("The Marquee") — availability-first ranking surface.
-- (Applied to production 2026-07-13 via worker/apply-sql.py; DDL then fpi_rebuild.)
-- Adds: rent/buy rows to film_provider_index, multi-country + US-library ranking,
--       a decoration RPC for access badges, and a watch-country directory.
--
-- INVARIANTS (see HANDOFF-왓투와치-스트리밍결정.md §9):
--   * rent/buy are BADGE-ONLY. They must never widen the ranking availability match
--     (a rental is not something you "have"). The EXISTS clause guards `kind not in ('rent','buy')`.
--   * Signature change on cinecodex_ranked / _mine => DROP old signature first, re-CREATE, re-GRANT
--     (create-or-replace overload trap). New args appended with defaults => existing callers
--     (Screener, /api/lens/takescore) are byte-for-byte unaffected.
--   * anon statement_timeout is 3s => every function pins 8s.
--   * _mine stays service_role only.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. fpi_rebuild(): add rent/buy kinds (badge source). Structure/PK unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fpi_rebuild()
 returns integer
 language plpgsql
 set search_path to 'public'
as $function$
declare n int;
begin
  delete from public.film_provider_index;
  insert into public.film_provider_index (film_id, country_code, provider_id, provider_name, provider_logo, kind)
  select distinct on (fwp.film_id, cc.key, (prov->>'provider_id')::int, k.kind)
         fwp.film_id, cc.key,
         (prov->>'provider_id')::int, prov->>'provider_name', prov->>'logo_path', k.kind
  from public.film_watch_providers fwp
  cross join lateral jsonb_each(fwp.results) cc(key, val)
  cross join lateral (values ('flatrate'),('ads'),('free'),('rent'),('buy')) k(kind)
  cross join lateral jsonb_array_elements(coalesce(cc.val->k.kind, '[]'::jsonb)) prov
  where jsonb_typeof(cc.val) = 'object' and cc.key ~ '^[A-Z]{2}$'
    and (prov->>'provider_id') is not null;
  get diagnostics n = row_count;
  return n;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. cinecodex_ranked v10 — multi-country + US library union.
--    New tail args: p_watch_countries text[], p_include_us_library boolean.
--    Defaults reproduce the v9 single-country behavior exactly.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.cinecodex_ranked(text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, integer, integer);

create function public.cinecodex_ranked(
  p_sort text default 'u', p_lambda numeric default 1.0, p_q text default null,
  p_year_min integer default null, p_year_max integer default null, p_country text default null,
  p_max_cost numeric default 100, p_sub jsonb default '{}'::jsonb,
  p_ts_min numeric default null, p_ts_max numeric default null,
  p_providers integer[] default null, p_watch_country text default null,
  p_max_votes integer default null, p_genre text default null,
  p_limit integer default 60, p_offset integer default 0,
  p_watch_countries text[] default null, p_include_us_library boolean default false)
 returns json
 language sql
 stable security definer
 set search_path to 'public', 'cinecodex', 'curation'
 set statement_timeout to '8s'
as $function$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.c_cost, s.r_risk,
      s.cog, s.aff, s.form, s.moral, s.dur, s.itx, s.fr, s.etx, s.ctx,
      s.bank, s.insincere, s.coward, s.polar
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  base as (
    select f.slug, f.title, f.year, f.poster_path, f.director,
           round(b.v_value,1) v, round(b.c_cost,1) c, round(b.r_risk,1) r,
           round(b.v_value - p_lambda*b.r_risk,1) u,
           round((b.v_value-50)/greatest(b.r_risk,1),2) sharpe,
           cf.country_code,
           rt.imdb_rating, rt.imdb_votes, rt.rt_tomatometer as rt
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
      and (p_max_votes is null or coalesce(rt.imdb_votes,0) <= p_max_votes)
      and (
        not ( (p_providers is not null and coalesce(array_length(p_providers,1),0) > 0) or p_include_us_library )
        or exists (
          select 1 from public.film_provider_index x
          where x.film_id = f.id
            and x.kind not in ('rent','buy')
            and (
              ( p_providers is not null and x.provider_id = any(p_providers)
                and x.country_code = any(coalesce(p_watch_countries, array[upper(coalesce(p_watch_country,''))])) )
              or
              ( p_include_us_library and x.country_code = 'US' and x.provider_id in (191,212) )
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
    select * from base
    where (p_ts_min is null or u >= p_ts_min) and (p_ts_max is null or u <= p_ts_max)
  ),
  ordered as (
    select tf.*, row_number() over (
      order by
        (case when p_sort='alpha' then null::numeric
              else (case p_sort
                      when 'v' then v when 'c' then -c when 'r' then -r
                      when 'sharpe' then sharpe when 'lowrisk' then -r
                      when 'newest' then year when 'oldest' then -year
                      else u end) end) desc nulls last,
        (case when p_sort='alpha' then lower(title) else null end) asc nulls last,
        slug) as rank
    from tsfiltered tf
  )
  select json_build_object(
    'total', (select count(*) from tsfiltered),
    'rows', coalesce((select json_agg(x) from (
        select * from ordered order by rank
        limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::json)
  );
$function$;

grant execute on function public.cinecodex_ranked(text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, integer, integer, text[], boolean) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. cinecodex_ranked_mine v10 — same tail args. service_role only.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.cinecodex_ranked_mine(uuid, text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, text, integer, integer);

create function public.cinecodex_ranked_mine(
  p_user uuid, p_sort text default 'u', p_lambda numeric default 1.0, p_q text default null,
  p_year_min integer default null, p_year_max integer default null, p_country text default null,
  p_max_cost numeric default 100, p_sub jsonb default '{}'::jsonb,
  p_ts_min numeric default null, p_ts_max numeric default null,
  p_providers integer[] default null, p_watch_country text default null,
  p_max_votes integer default null, p_mode text default 'only', p_genre text default null,
  p_limit integer default 60, p_offset integer default 0,
  p_watch_countries text[] default null, p_include_us_library boolean default false)
 returns json
 language sql
 stable security definer
 set search_path to 'public', 'cinecodex', 'curation'
 set statement_timeout to '8s'
as $function$
  with best as (
    select distinct on (s.film_id) s.film_id, s.v_value, s.c_cost, s.r_risk,
      s.cog, s.aff, s.form, s.moral, s.dur, s.itx, s.fr, s.etx, s.ctx,
      s.bank, s.insincere, s.coward, s.polar
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  base as (
    select f.slug, f.title, f.year, f.poster_path, f.director,
           round(b.v_value,1) v, round(b.c_cost,1) c, round(b.r_risk,1) r,
           round(b.v_value - p_lambda*b.r_risk,1) u,
           round((b.v_value-50)/greatest(b.r_risk,1),2) sharpe,
           cf.country_code,
           rt.imdb_rating, rt.imdb_votes, rt.rt_tomatometer as rt
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
      and (p_max_votes is null or coalesce(rt.imdb_votes,0) <= p_max_votes)
      and (
        not ( (p_providers is not null and coalesce(array_length(p_providers,1),0) > 0) or p_include_us_library )
        or exists (
          select 1 from public.film_provider_index x
          where x.film_id = f.id
            and x.kind not in ('rent','buy')
            and (
              ( p_providers is not null and x.provider_id = any(p_providers)
                and x.country_code = any(coalesce(p_watch_countries, array[upper(coalesce(p_watch_country,''))])) )
              or
              ( p_include_us_library and x.country_code = 'US' and x.provider_id in (191,212) )
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
    select * from base
    where (p_ts_min is null or u >= p_ts_min) and (p_ts_max is null or u <= p_ts_max)
  ),
  ordered as (
    select tf.*, row_number() over (
      order by
        (case when p_sort='alpha' then null::numeric
              else (case p_sort
                      when 'v' then v when 'c' then -c when 'r' then -r
                      when 'sharpe' then sharpe when 'lowrisk' then -r
                      when 'newest' then year when 'oldest' then -year
                      else u end) end) desc nulls last,
        (case when p_sort='alpha' then lower(title) else null end) asc nulls last,
        slug) as rank
    from tsfiltered tf
  )
  select json_build_object(
    'total', (select count(*) from tsfiltered),
    'rows', coalesce((select json_agg(x) from (
        select * from ordered order by rank
        limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::json)
  );
$function$;

revoke all on function public.cinecodex_ranked_mine(uuid, text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, text, integer, integer, text[], boolean) from anon, authenticated, public;
grant execute on function public.cinecodex_ranked_mine(uuid, text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, text, integer, integer, text[], boolean) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. film_availability() — badge decoration for the visible rows only.
--    Returns per-slug the access rows the UI needs: streaming (my providers),
--    free/ads (any provider), rent/buy (my providers), + US library union.
--    kind => tier mapping happens client-side (flatrate=Streaming, free/ads=Free,
--    rent/buy=Rent, provider 191/212=library).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.film_availability(
  p_slugs text[], p_countries text[] default null,
  p_providers integer[] default null, p_include_us_library boolean default false)
 returns table(slug text, tiers jsonb)
 language sql
 stable security definer
 set search_path to 'public'
 set statement_timeout to '8s'
as $function$
  select f.slug,
         jsonb_agg(distinct jsonb_build_object(
           'kind', x.kind, 'pid', x.provider_id, 'name', x.provider_name,
           'logo', x.provider_logo, 'cc', x.country_code))
  from public.films f
  join public.film_provider_index x on x.film_id = f.id
  where f.slug = any(p_slugs)
    and (
      ( x.country_code = any(coalesce(p_countries, '{}'::text[]))
        and (
          (x.kind = 'flatrate' and (p_providers is null or x.provider_id = any(p_providers)))
          or x.kind in ('free','ads')
          or (x.kind in ('rent','buy') and p_providers is not null and x.provider_id = any(p_providers))
        )
      )
      or ( p_include_us_library and x.country_code = 'US' and x.provider_id in (191,212) )
    )
  group by f.slug;
$function$;

grant execute on function public.film_availability(text[], text[], integer[], boolean) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. wtw_countries() — watch-country directory (distinct from cinecodex_countries,
--    which is "made in"). Ordered by catalogue depth.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.wtw_countries()
 returns json
 language sql
 stable security definer
 set search_path to 'public'
 set statement_timeout to '8s'
as $function$
  select coalesce(json_agg(json_build_object('code', country_code, 'n_films', nf, 'n_prov', np) order by nf desc), '[]'::json)
  from (
    select country_code, count(distinct film_id) nf, count(distinct provider_id) np
    from public.film_provider_index
    where kind in ('flatrate','ads','free')
    group by country_code
    having count(distinct film_id) >= 5
  ) t;
$function$;

grant execute on function public.wtw_countries() to anon, authenticated, service_role;

commit;

-- Rebuild the index with rent/buy included (run outside the txn boundary if heavy).
select public.fpi_rebuild();
