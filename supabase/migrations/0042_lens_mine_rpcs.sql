-- 0042: My Films lens — per-user "mine" RPCs (final state, idempotent)
--
-- ALREADY APPLIED to prod via Supabase MCP on 2026-07-06 in four steps
-- (readings_mine_lens, lens_entity_mine_rpcs, lens_films_mine_and_director_faces,
-- films_mine_include_tier2). This file consolidates the FINAL state so the repo
-- records the schema; re-running is safe (CREATE OR REPLACE + re-asserted grants).
--
-- Security invariant: every *_mine function is SERVICE-ROLE-ONLY. They take
-- p_user as a parameter, so anon/authenticated execution would let anyone pass
-- an arbitrary uid and read which films another user has seen. The uid must
-- come from a session-validated /api/lens/* route (see HANDOFF-마이필름-렌즈.md).

-- ============ Strong Misreadings feed, only-mode ============
create or replace function public.readings_mine(
  p_user uuid, p_fw text default null, p_sort text default 'film',
  p_trope text default null, p_decade integer default null,
  p_limit integer default 24, p_offset integer default 0)
returns jsonb language sql stable
set search_path to 'public' set statement_timeout to '15s'
as $function$
  with base as (
    select t.id, t.take_title, t.rationale, t.framework, t.strength, t.created_at,
           fg.label as fig_label, fg.slug as fig_slug,
           f.title as film_title, f.slug as film_slug, f.year as film_year,
           f.backdrop_path as bd, f.poster_path as poster,
           mt.title as trope_title, mt.slug as trope_slug
    from takes t
    join figures fg on fg.id = t.figure_id and fg.status='approved'
    join films f on f.id = fg.film_id and f.visible
    join user_movies um on um.film_id = f.id and um.user_id = p_user and um.seen
    left join meta_takes mt on mt.id = t.trope_id and mt.kind='figure_type' and mt.status='published'
    where t.status='published' and t.framework <> 'INVITATION'
      and (p_fw is null or t.framework = p_fw)
      and (p_trope is null or mt.slug = p_trope)
      and (p_decade is null or (f.year >= p_decade and f.year < p_decade + 10))
  ),
  ranked as (
    select b.*, row_number() over (order by
      (case when p_sort='recent' then created_at end) desc nulls last,
      (case when p_sort='bold' then strength end) desc nulls last,
      (case when p_sort='year_desc' then film_year end) desc nulls last,
      (case when p_sort='year_asc' then film_year end) asc nulls last,
      (case when p_sort='film' then lower(film_title) end) asc nulls last,
      lower(film_title) asc, take_title asc
    ) as rn
    from base b
  ),
  page as (select * from ranked where rn > greatest(p_offset,0) and rn <= greatest(p_offset,0) + greatest(p_limit,1))
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'tt', p.take_title, 'fw', p.framework,
        'snip', left(regexp_replace(coalesce(p.rationale,''), '\s+', ' ', 'g'), 300),
        'fig', p.fig_label, 'figslug', p.fig_slug,
        'film', p.film_title, 'filmslug', p.film_slug, 'year', p.film_year,
        'bd', p.bd, 'poster', p.poster,
        'trope', p.trope_title, 'tropeslug', p.trope_slug
      ) order by p.rn) from page p), '[]'::jsonb)
  );
$function$;

-- ============ Entity indexes, only-mode (ranked by my-film count) ============
create or replace function public.tropes_mine(p_user uuid, p_limit integer default 500, p_offset integer default 0)
returns jsonb language sql stable
set search_path to 'public' set statement_timeout to '15s'
as $function$
  with base as (
    select m.slug, m.title as label, null::text as sub, count(distinct f.id)::int as n
    from meta_takes m
    join figure_type_members mm on mm.meta_take_id = m.id
    join figures fg on fg.id = mm.figure_id
    join films f on f.id = fg.film_id and f.visible
    join user_movies um on um.film_id = f.id and um.user_id = p_user and um.seen
    where m.kind='figure_type' and m.status='published'
    group by m.slug, m.title
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(x) from (
      select * from base order by n desc, label asc
      limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::jsonb));
$function$;

create or replace function public.concepts_mine(p_user uuid, p_limit integer default 500, p_offset integer default 0)
returns jsonb language sql stable
set search_path to 'public' set statement_timeout to '15s'
as $function$
  with base as (
    select coalesce(c.canon_slug, c.slug) as slug,
           max(coalesce(c.canon_name, c.name)) as label,
           null::text as sub,
           count(distinct fl.id)::int as n
    from sm_concepts c
    join concept_map k on k.concept_id = c.id
    join takes t on lower(btrim(t.concept)) = k.raw_l and t.status='published'
    join figures f on f.id = t.figure_id
    join films fl on fl.id = f.film_id and fl.visible
    join user_movies um on um.film_id = fl.id and um.user_id = p_user and um.seen
    group by coalesce(c.canon_slug, c.slug)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(x) from (
      select * from base order by n desc, label asc
      limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::jsonb));
$function$;

create or replace function public.theorists_mine(p_user uuid, p_limit integer default 500, p_offset integer default 0)
returns jsonb language sql stable
set search_path to 'public' set statement_timeout to '15s'
as $function$
  with base as (
    select th.slug, th.name as label, null::text as sub, count(distinct fl.id)::int as n
    from theorists th
    join takes t on t.theorist_id = th.id and t.status='published'
    join figures f on f.id = t.figure_id
    join films fl on fl.id = f.film_id and fl.visible
    join user_movies um on um.film_id = fl.id and um.user_id = p_user and um.seen
    group by th.slug, th.name
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(x) from (
      select * from base order by n desc, label asc
      limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::jsonb));
$function$;

create or replace function public.traditions_mine(p_user uuid, p_limit integer default 500, p_offset integer default 0)
returns jsonb language sql stable
set search_path to 'public' set statement_timeout to '15s'
as $function$
  with base as (
    select c.slug, c.title as label, c.theorist as sub, count(distinct fl.id)::int as n
    from theory_canon c
    join take_canon tc on tc.canon_id = c.id
    join takes t on t.id = tc.take_id and t.status='published'
    join figures f on f.id = t.figure_id
    join films fl on fl.id = f.film_id and fl.visible
    join user_movies um on um.film_id = fl.id and um.user_id = p_user and um.seen
    where c.slug is not null
    group by c.slug, c.title, c.theorist
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(x) from (
      select * from base order by n desc, label asc
      limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::jsonb));
$function$;

create or replace function public.directors_mine(p_user uuid, p_limit integer default 500, p_offset integer default 0)
returns jsonb language sql stable
set search_path to 'public' set statement_timeout to '15s'
as $function$
  with base as (
    select f.director_slug as slug,
           coalesce(max(dr.name), max(f.director)) as label,
           director_country(max(dr.place_of_birth)) as sub,
           max(dr.profile_path) as img,
           count(distinct f.id)::int as n
    from films f
    join user_movies um on um.film_id = f.id and um.user_id = p_user and um.seen
    left join directors dr on dr.slug = f.director_slug
    where f.visible and f.director_slug is not null
    group by f.director_slug
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(x) from (
      select * from base order by n desc, label asc
      limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::jsonb));
$function$;

-- /film only-mode: the user's whole seen list, newest first (Tier-2 included;
-- only slug-stub rows excluded — matches the Full catalogue inclusion rule)
create or replace function public.films_mine(p_user uuid, p_limit integer default 1000, p_offset integer default 0)
returns jsonb language sql stable
set search_path to 'public' set statement_timeout to '15s'
as $function$
  with base as (
    select f.slug, f.title as label, f.director as sub, f.year, f.poster_path as img
    from films f
    join user_movies um on um.film_id = f.id and um.user_id = p_user and um.seen
    where f.slug not like 'tmdb-%'
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(x) from (
      select slug, label, sub, year, img, null::int as n
      from base order by year desc nulls last, label asc
      limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::jsonb));
$function$;

-- ============ TakeScore, only-mode (full filter passthrough) ============
create or replace function public.cinecodex_ranked_mine(
  p_user uuid, p_sort text default 'u', p_lambda numeric default 1.0,
  p_q text default null, p_year_min integer default null, p_year_max integer default null,
  p_country text default null, p_max_cost numeric default 100, p_sub jsonb default '{}'::jsonb,
  p_limit integer default 60, p_offset integer default 0)
returns json language sql stable security definer
set search_path to 'public', 'cinecodex', 'curation'
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
           cf.country_code
    from best b
    join public.films f on f.id=b.film_id
    join public.user_movies um on um.film_id = f.id and um.user_id = p_user and um.seen
    left join curation.film cf on cf.tmdb_id=f.tmdb_id
    where b.c_cost <= p_max_cost
      and (p_q is null or p_q='' or f.title ilike '%'||p_q||'%')
      and (p_year_min is null or f.year >= p_year_min)
      and (p_year_max is null or f.year <= p_year_max)
      and (p_country is null or p_country='' or cf.country_code = p_country)
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
  )
  select json_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select json_agg(x) from (
        select * from base
        order by (case p_sort
                   when 'v' then v
                   when 'c' then -c
                   when 'r' then -r
                   when 'sharpe' then sharpe
                   when 'lowrisk' then -r
                   when 'newest' then year
                   when 'oldest' then -year
                   else u end) desc nulls last
        limit greatest(p_limit,1) offset greatest(p_offset,0)) x), '[]'::json)
  );
$function$;

-- ============ Lock everything down to the service role ============
do $$
declare fn text;
begin
  foreach fn in array array[
    'readings_mine(uuid,text,text,text,integer,integer,integer)',
    'tropes_mine(uuid,integer,integer)',
    'concepts_mine(uuid,integer,integer)',
    'theorists_mine(uuid,integer,integer)',
    'traditions_mine(uuid,integer,integer)',
    'directors_mine(uuid,integer,integer)',
    'films_mine(uuid,integer,integer)',
    'cinecodex_ranked_mine(uuid,text,numeric,text,integer,integer,text,numeric,jsonb,integer,integer)'
  ] loop
    execute format('revoke execute on function public.%s from public', fn);
    execute format('revoke execute on function public.%s from anon', fn);
    execute format('revoke execute on function public.%s from authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end $$;
