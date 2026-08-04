-- 0132 — multi-select production country on the two ranked read-path RPCs.
--
-- ⚠️ DEPLOY ORDER: apply this BEFORE the web build that sends p_countries.
-- PostgREST resolves an RPC by the argument NAMES it is given, so a client that
-- names an argument the function does not have gets PGRST202 ("could not find
-- the function") — not a fallback. Migration first, then the frontend. The
-- reverse order is safe for existing callers but breaks the new filter.
--
-- WHY
-- The app's Tonight deck lets a viewer pick up to five production countries; the
-- web could not, because cinecodex_ranked's p_country is a single equality.
-- HANDOFF-앱에서-웹으로-이식.md §2.3 left two options: fan out one ranking query
-- per country and merge in the client (what the app's BFF does), or teach the
-- RPC an array. The web took neither and shipped single-select, because the
-- fan-out caps rows per country (300 in the app) and the web shows a `total` and
-- a "Load more" — a truncated pool there reads as the whole answer, and the US
-- alone has 2,150 films. This migration removes the reason to choose: the filter
-- happens in the one query that also counts, so total and paging stay exact.
--
-- WHAT CHANGES
-- Both functions gain a trailing `p_countries text[] default null`, and one
-- WHERE clause. Everything else — body, ordering, timeouts, security — is the
-- 0096 v11 text verbatim (verified against the live definition, 2026-08-04).
--
-- ADDITIVE FOR EVERY EXISTING CALLER
-- The new argument is last and defaults to null, and null/empty is a no-op, so
-- the Screener, the app BFF, saved views and any deployed bundle keep working
-- unchanged. The old signature is DROPPED rather than left beside the new one:
-- two overloads differing by one defaulted argument are ambiguous to PostgREST
-- when the argument is omitted (the trap that bit surprise_home). Drop-then-
-- create with a longer, all-defaulted signature is exactly what 0096 did.
--
-- ROLLBACK: re-run 0096's two create statements after dropping these.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. cinecodex_ranked v12
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.cinecodex_ranked(text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, integer, integer, text[], boolean, text[], text, boolean);

create function public.cinecodex_ranked(
  p_sort text default 'u', p_lambda numeric default 1.0, p_q text default null,
  p_year_min integer default null, p_year_max integer default null, p_country text default null,
  p_max_cost numeric default 100, p_sub jsonb default '{}'::jsonb,
  p_ts_min numeric default null, p_ts_max numeric default null,
  p_providers integer[] default null, p_watch_country text default null,
  p_max_votes integer default null, p_genre text default null,
  p_limit integer default 60, p_offset integer default 0,
  p_watch_countries text[] default null, p_include_us_library boolean default false,
  p_genres text[] default null, p_dir text default null, p_include_rent boolean default false,
  p_countries text[] default null)
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
      -- Multi-select production country (0132). Kept ALONGSIDE the single
      -- p_country above rather than replacing it: every existing caller —
      -- the Screener, the app's BFF, saved views — still sends that one, and
      -- a null/empty array is a no-op, so the two compose without a flag day.
      -- Lowercased on both sides because curation.film.country_code is stored
      -- lowercase and an uppercase 'JP' from a caller would silently match 0.
      -- The array() subquery is uncorrelated, so it is built once per query.
      and (p_countries is null or coalesce(array_length(p_countries,1),0)=0
           or lower(cf.country_code) = any(array(select lower(btrim(c)) from unnest(p_countries) c)))
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

comment on function public.cinecodex_ranked(text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, integer, integer, text[], boolean, text[], text, boolean, text[]) is
  'Ranked catalogue read (v12). p_countries text[] = multi-select PRODUCTION country (curation.film.country_code, lowercase); composes with the single p_country and with p_watch_country/p_watch_countries, which are about AVAILABILITY and are a different axis entirely.';

grant execute on function public.cinecodex_ranked(text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, integer, integer, text[], boolean, text[], text, boolean, text[]) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. cinecodex_ranked_mine v12 — same change, service_role only (it takes a
--    user id, so it must never be callable by anon/authenticated directly).
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.cinecodex_ranked_mine(uuid, text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, text, integer, integer, text[], boolean, text[], text, boolean);

create function public.cinecodex_ranked_mine(
  p_user uuid, p_sort text default 'u', p_lambda numeric default 1.0, p_q text default null,
  p_year_min integer default null, p_year_max integer default null, p_country text default null,
  p_max_cost numeric default 100, p_sub jsonb default '{}'::jsonb,
  p_ts_min numeric default null, p_ts_max numeric default null,
  p_providers integer[] default null, p_watch_country text default null,
  p_max_votes integer default null, p_mode text default 'only', p_genre text default null,
  p_limit integer default 60, p_offset integer default 0,
  p_watch_countries text[] default null, p_include_us_library boolean default false,
  p_genres text[] default null, p_dir text default null, p_include_rent boolean default false,
  p_countries text[] default null)
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
      -- Multi-select production country (0132). Kept ALONGSIDE the single
      -- p_country above rather than replacing it: every existing caller —
      -- the Screener, the app's BFF, saved views — still sends that one, and
      -- a null/empty array is a no-op, so the two compose without a flag day.
      -- Lowercased on both sides because curation.film.country_code is stored
      -- lowercase and an uppercase 'JP' from a caller would silently match 0.
      -- The array() subquery is uncorrelated, so it is built once per query.
      and (p_countries is null or coalesce(array_length(p_countries,1),0)=0
           or lower(cf.country_code) = any(array(select lower(btrim(c)) from unnest(p_countries) c)))
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

comment on function public.cinecodex_ranked_mine(uuid, text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, text, integer, integer, text[], boolean, text[], text, boolean, text[]) is
  'Personal ranked catalogue read (v12) — p_mode only/exclude against user_movies. Adds p_countries text[] (multi-select production country), matching cinecodex_ranked so the Hide-seen path and the public path can never disagree about what a filter means.';

revoke all on function public.cinecodex_ranked_mine(uuid, text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, text, integer, integer, text[], boolean, text[], text, boolean, text[]) from anon, authenticated, public;
grant execute on function public.cinecodex_ranked_mine(uuid, text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, text, integer, integer, text[], boolean, text[], text, boolean, text[]) to service_role;
