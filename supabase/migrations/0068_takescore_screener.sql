-- 0068_takescore_screener.sql — DB layer for the /takescore Screener redesign.
-- Spec: HANDOFF-테이크스코어-스크리너.md §6.
--
-- 1. film_provider_index — a normalized (film, country, provider, kind) row set
--    unnested from film_watch_providers.results (jsonb), so the ranking query can
--    filter "streaming in KR on Netflix/Watcha" with an index instead of a jsonb
--    scan over 6,974 films. Rebuilt by fpi_rebuild() (migration + worker refresh).
-- 2. cinecodex_ranked v8 — adds imdb/rt/rank to the return + p_ts_min/max,
--    p_providers/p_watch_country, p_max_votes to the args. Signature change →
--    DROP first, re-GRANT after (drop wipes grants). Additive returns keep every
--    existing caller (takescore page, lib/takescore-bulk) working.
-- 3. cinecodex_ranked_mine v2 — same additions + p_mode ('only'|'exclude') for the
--    big Hide-seen toggle. Service-role only (re-locked).
-- 4. cinecodex_histogram — TS distribution for the brush (all filters EXCEPT ts).
-- 5. cinecodex_dim_histograms — global per-dimension distributions (brush minis).
-- 6. provider_directory(country) — provider palette for the "My services" popover.

-- ── 1 · film_provider_index ─────────────────────────────────────────────────
create table if not exists public.film_provider_index (
  film_id       uuid not null references public.films(id) on delete cascade,
  country_code  text not null,               -- 'KR'
  provider_id   int  not null,
  provider_name text not null,
  provider_logo text,                         -- TMDB relative logo_path
  kind          text not null,               -- 'flatrate' | 'ads' | 'free' (subscription-shaped; rent/buy excluded)
  primary key (film_id, country_code, provider_id, kind)
);
create index if not exists fpi_country_provider on public.film_provider_index (country_code, provider_id) include (film_id);
create index if not exists fpi_film on public.film_provider_index (film_id);

alter table public.film_provider_index enable row level security;
drop policy if exists fpi_read on public.film_provider_index;
create policy fpi_read on public.film_provider_index for select using (true);  -- public availability data

create or replace function public.fpi_rebuild() returns int
language plpgsql
set search_path to 'public'
as $$
declare n int;
begin
  delete from public.film_provider_index;
  insert into public.film_provider_index (film_id, country_code, provider_id, provider_name, provider_logo, kind)
  select distinct on (fwp.film_id, cc.key, (prov->>'provider_id')::int, k.kind)
         fwp.film_id, cc.key,
         (prov->>'provider_id')::int, prov->>'provider_name', prov->>'logo_path', k.kind
  from public.film_watch_providers fwp
  cross join lateral jsonb_each(fwp.results) cc(key, val)
  cross join lateral (values ('flatrate'),('ads'),('free')) k(kind)
  cross join lateral jsonb_array_elements(coalesce(cc.val->k.kind, '[]'::jsonb)) prov
  where jsonb_typeof(cc.val) = 'object'
    and cc.key ~ '^[A-Z]{2}$'
    and (prov->>'provider_id') is not null;
  get diagnostics n = row_count;
  return n;
end;
$$;

select public.fpi_rebuild();

-- ── 2 · cinecodex_ranked v8 ─────────────────────────────────────────────────
drop function if exists public.cinecodex_ranked(text, numeric, text, integer, integer, text, numeric, jsonb, integer, integer);
create function public.cinecodex_ranked(
  p_sort text default 'u', p_lambda numeric default 1.0, p_q text default null,
  p_year_min integer default null, p_year_max integer default null, p_country text default null,
  p_max_cost numeric default 100, p_sub jsonb default '{}'::jsonb,
  p_ts_min numeric default null, p_ts_max numeric default null,
  p_providers integer[] default null, p_watch_country text default null, p_max_votes integer default null,
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
      order by (case p_sort
                 when 'v' then v when 'c' then -c when 'r' then -r
                 when 'sharpe' then sharpe when 'lowrisk' then -r
                 when 'newest' then year when 'oldest' then -year
                 else u end) desc nulls last, slug) as rank
    from tsfiltered tf
  )
  select json_build_object(
    'total', (select count(*) from tsfiltered),
    'rows', coalesce((select json_agg(x) from (
        select * from ordered order by rank
        limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::json)
  );
$function$;
grant execute on function public.cinecodex_ranked(text, numeric, text, integer, integer, text, numeric, jsonb, numeric, numeric, integer[], text, integer, integer, integer) to anon, authenticated, service_role;

-- ── 3 · cinecodex_ranked_mine v2 (adds p_mode; same new filters) ────────────
drop function if exists public.cinecodex_ranked_mine(uuid, text, numeric, text, integer, integer, text, numeric, jsonb, integer, integer);
create function public.cinecodex_ranked_mine(
  p_user uuid, p_sort text default 'u', p_lambda numeric default 1.0,
  p_q text default null, p_year_min integer default null, p_year_max integer default null,
  p_country text default null, p_max_cost numeric default 100, p_sub jsonb default '{}'::jsonb,
  p_ts_min numeric default null, p_ts_max numeric default null,
  p_providers integer[] default null, p_watch_country text default null, p_max_votes integer default null,
  p_mode text default 'only',
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
           cf.country_code,
           rt.imdb_rating, rt.imdb_votes, rt.rt_tomatometer as rt
    from best b
    join public.films f on f.id=b.film_id
    left join curation.film cf on cf.tmdb_id=f.tmdb_id
    left join public.film_ratings rt on rt.film_id = f.id
    where b.c_cost <= p_max_cost
      -- p_mode: 'exclude' hides my seen films (the Hide-seen toggle); 'only' keeps only them (the lens)
      and (case when p_mode='exclude'
                then not exists (select 1 from public.user_movies um where um.film_id=f.id and um.user_id=p_user and um.seen)
                else     exists (select 1 from public.user_movies um where um.film_id=f.id and um.user_id=p_user and um.seen) end)
      and (p_q is null or p_q='' or f.title ilike '%'||p_q||'%')
      and (p_year_min is null or f.year >= p_year_min)
      and (p_year_max is null or f.year <= p_year_max)
      and (p_country is null or p_country='' or cf.country_code = p_country)
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
      order by (case p_sort
                 when 'v' then v when 'c' then -c when 'r' then -r
                 when 'sharpe' then sharpe when 'lowrisk' then -r
                 when 'newest' then year when 'oldest' then -year
                 else u end) desc nulls last, slug) as rank
    from tsfiltered tf
  )
  select json_build_object(
    'total', (select count(*) from tsfiltered),
    'rows', coalesce((select json_agg(x) from (
        select * from ordered order by rank
        limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::json)
  );
$function$;

-- ── 4 · cinecodex_histogram — TS distribution for the brush (excludes ts range) ─
-- Fixed domain [-20, 90] in 22 buckets of 5 (TS ranges −50..86; p05..p95 = −0.6..62.8).
create or replace function public.cinecodex_histogram(
  p_lambda numeric default 1.0, p_q text default null,
  p_year_min integer default null, p_year_max integer default null, p_country text default null,
  p_max_cost numeric default 100, p_sub jsonb default '{}'::jsonb,
  p_providers integer[] default null, p_watch_country text default null, p_max_votes integer default null)
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
    select b.v_value - p_lambda*b.r_risk as u
    from best b
    join public.films f on f.id=b.film_id
    left join curation.film cf on cf.tmdb_id=f.tmdb_id
    left join public.film_ratings rt on rt.film_id = f.id
    where b.c_cost <= p_max_cost
      and (p_q is null or p_q='' or f.title ilike '%'||p_q||'%')
      and (p_year_min is null or f.year >= p_year_min)
      and (p_year_max is null or f.year <= p_year_max)
      and (p_country is null or p_country='' or cf.country_code = p_country)
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
  bk as (
    select width_bucket(least(greatest(u,-20),89.999), -20, 90, 22) as b, count(*)::int n
    from base group by 1
  )
  select json_build_object(
    'domain', json_build_array(-20, 90), 'step', 5,
    'buckets', coalesce((select json_agg(json_build_object('lo', -20 + (g-1)*5, 'n', coalesce(bk.n,0)) order by g)
                         from generate_series(1,22) g left join bk on bk.b=g), '[]'::json)
  );
$function$;
grant execute on function public.cinecodex_histogram(numeric, text, integer, integer, text, numeric, jsonb, integer[], text, integer) to anon, authenticated, service_role;

-- ── 5 · cinecodex_dim_histograms — global per-dimension distributions (0–100) ─
create or replace function public.cinecodex_dim_histograms()
returns json language sql stable security definer
set search_path to 'public', 'cinecodex'
set statement_timeout to '8s'
as $function$
  with best as (
    select distinct on (s.film_id)
      s.cog, s.aff, s.form, s.moral, s.dur, s.itx, s.fr, s.etx, s.ctx,
      s.bank, s.insincere, s.coward, s.polar
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  long as (
    select v.code, v.val from best b, lateral (values
      ('cog',b.cog),('aff',b.aff),('form',b.form),('moral',b.moral),('dur',b.dur),
      ('itx',b.itx),('fr',b.fr),('etx',b.etx),('ctx',b.ctx),
      ('bank',b.bank),('insincere',b.insincere),('coward',b.coward),('polar',b.polar)) v(code,val)
    where v.val is not null
  ),
  bk as (
    select code, width_bucket(least(greatest(val,0),99.999), 0, 100, 20) as b, count(*)::int n
    from long group by code, 2
  ),
  codes as (select distinct code from long),
  grid as (select c.code, g from codes c cross join generate_series(1,20) g)
  select coalesce(json_object_agg(code, arr), '{}'::json) from (
    select grid.code, json_agg(json_build_object('lo',(grid.g-1)*5,'n',coalesce(bk.n,0)) order by grid.g) arr
    from grid left join bk on bk.code=grid.code and bk.b=grid.g
    group by grid.code
  ) z;
$function$;
grant execute on function public.cinecodex_dim_histograms() to anon, authenticated, service_role;

-- ── 6 · provider_directory — the "My services" popover palette ───────────────
create or replace function public.provider_directory(p_country text)
returns json language sql stable security definer
set search_path to 'public'
set statement_timeout to '8s'
as $function$
  select coalesce(json_agg(json_build_object(
           'provider_id', provider_id, 'provider_name', provider_name,
           'logo_path', provider_logo, 'n', n) order by n desc, provider_name), '[]'::json)
  from (
    select provider_id, min(provider_name) provider_name, min(provider_logo) provider_logo,
           count(distinct film_id)::int n
    from public.film_provider_index
    where country_code = upper(coalesce(p_country,'')) and kind in ('flatrate','ads','free')
    group by provider_id
    order by n desc
    limit 40
  ) x;
$function$;
grant execute on function public.provider_directory(text) to anon, authenticated, service_role;

-- ── 7 · re-lock the *_mine function to service_role (drop wiped grants) ──────
do $$
begin
  execute 'revoke execute on function public.cinecodex_ranked_mine(uuid,text,numeric,text,integer,integer,text,numeric,jsonb,numeric,numeric,integer[],text,integer,text,integer,integer) from public';
  execute 'revoke execute on function public.cinecodex_ranked_mine(uuid,text,numeric,text,integer,integer,text,numeric,jsonb,numeric,numeric,integer[],text,integer,text,integer,integer) from anon';
  execute 'revoke execute on function public.cinecodex_ranked_mine(uuid,text,numeric,text,integer,integer,text,numeric,jsonb,numeric,numeric,integer[],text,integer,text,integer,integer) from authenticated';
  execute 'grant execute on function public.cinecodex_ranked_mine(uuid,text,numeric,text,integer,integer,text,numeric,jsonb,numeric,numeric,integer[],text,integer,text,integer,integer) to service_role';
end $$;
