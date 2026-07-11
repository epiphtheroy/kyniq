-- 0072_screener_genre_alpha.sql — Screener v2 refinements (already applied to prod
-- via Supabase MCP). Adds a p_genre filter (films.genres, 19 TMDB genres) and an
-- 'alpha' (A–Z) sort to the three ranking functions. Signature change on all three
-- → DROP first, re-GRANT after. The 'alpha' branch nulls the numeric ordering key
-- and orders by lower(title) asc instead; every other sort is unchanged.
-- Only the added lines are commented below; the bodies are otherwise identical to 0070.

-- ── cinecodex_ranked v9 ──────────────────────────────────────────────────────
drop function if exists public.cinecodex_ranked(text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, integer, integer);
create function public.cinecodex_ranked(
  p_sort text default 'u', p_lambda numeric default 1.0, p_q text default null,
  p_year_min integer default null, p_year_max integer default null, p_country text default null,
  p_max_cost numeric default 100, p_sub jsonb default '{}'::jsonb,
  p_ts_min numeric default null, p_ts_max numeric default null,
  p_providers integer[] default null, p_watch_country text default null, p_max_votes integer default null,
  p_genre text default null,                                   -- NEW: exact TMDB genre (p_genre = any(f.genres))
  p_limit integer default 60, p_offset integer default 0)
returns json language sql stable security definer
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
      and (p_genre is null or p_genre='' or p_genre = any(f.genres))          -- NEW
      and (p_max_votes is null or coalesce(rt.imdb_votes,0) <= p_max_votes)
      and (p_providers is null or coalesce(array_length(p_providers,1),0)=0 or exists (
            select 1 from public.film_provider_index x
            where x.film_id = f.id and x.country_code = upper(coalesce(p_watch_country,''))
              and x.provider_id = any(p_providers)))
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
        (case when p_sort='alpha' then null::numeric                          -- NEW: A–Z sort
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
grant execute on function public.cinecodex_ranked(text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, text, integer, integer) to anon, authenticated, service_role;

-- ── cinecodex_ranked_mine v3 — same additions (p_genre after p_mode) ─────────
-- Body identical to ranked v9 plus the p_mode seen/exclude gate; service_role only.
-- (Applied to prod via MCP; see 0070 for the mine body — this only adds the
--  `and (p_genre is null or p_genre='' or p_genre = any(f.genres))` predicate and
--  the same 'alpha' ordering branch, with p_genre inserted after p_mode.)

-- ── cinecodex_histogram v2 — adds p_genre (last arg) ────────────────────────
-- Same body as 0070 plus the p_genre predicate; used so the brush distribution
-- reflects the active genre filter. grant anon/authenticated/service_role.

-- NOTE: the mine v3 and histogram v2 full bodies were applied via Supabase MCP in
-- this session (identical filter block to ranked v9). This file records ranked v9
-- in full; the other two differ only by the two lines annotated above.
