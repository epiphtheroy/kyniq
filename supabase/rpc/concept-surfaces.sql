-- Snapshot of concept-surface RPCs after migration concept_map_joins (2026-07-04).
-- These read takes.concept through concept_map (exact + embedding >= 0.70) instead of
-- exact name_l equality. Also rewritten by the same migration (bodies unchanged apart
-- from the same mechanical join swap): map_overview, surprise_home, home_v2_bundle.

CREATE OR REPLACE FUNCTION public.sm_concept_readings(p_slug text, p_limit integer DEFAULT 300)
 RETURNS TABLE(take_id uuid, take_title text, framework text, thesis text, leap text, theorist_name text, theorist_slug text, fig_label text, fig_slug text, film_title text, film_slug text, film_year integer, backdrop_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.id, t.take_title, t.framework, t.rationale, t.leap,
         t.theorist_name, th.slug, f.label, f.slug,
         fl.title, fl.slug, fl.year, fl.backdrop_path
  from public.sm_concepts c
  join public.takes t on exists (select 1 from public.concept_map k9 where k9.raw_l = lower(btrim(t.concept)) and k9.concept_id = c.id) and t.status='published'
  join public.figures f on f.id = t.figure_id
  join public.films fl on fl.id = f.film_id
  left join public.theorists th on th.id = t.theorist_id
  where c.slug = p_slug
  order by fl.year desc nulls last, fl.title asc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.concept_detail(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '20s'
AS $function$
with res as (
  select canon_slug from sm_concepts where canon_slug = p_slug or slug = p_slug limit 1
),
mem as (
  select sc.name_l, sc.native, sc.n, sc.canon_name
  from sm_concepts sc where sc.canon_slug = (select canon_slug from res)
),
tk as (
  select t.id, t.trope_id, t.theorist_id, t.take_title, t.strength,
         fig.film_id, fig.label fig_label, fig.slug fig_slug
  from takes t join figures fig on fig.id = t.figure_id
  where t.status='published' and lower(btrim(t.concept)) in (select k9.raw_l from public.concept_map k9 join public.sm_concepts s9 on s9.id=k9.concept_id where s9.canon_slug = (select canon_slug from res))
),
myfilms as (select distinct film_id from tk)
select case when (select canon_slug from res) is null then null else jsonb_build_object(
  'slug', (select canon_slug from res),
  'name', (select canon_name from mem limit 1),
  'native', (select native from mem where native is not null order by n desc limit 1),
  'stats', jsonb_build_object(
    'films', (select count(*) from myfilms),
    'readings', (select count(*) from tk),
    'tropes', (select count(distinct trope_id) from tk where trope_id is not null)
  ),
  'theorist', (
    select jsonb_build_object('name', th.name, 'slug', th.slug)
    from (select theorist_id, count(*) c from tk where theorist_id is not null group by theorist_id order by c desc limit 1) top
    join theorists th on th.id = top.theorist_id
  ),
  'tropes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', title, 'slug', slug, 'film_count', film_count, 'takes_here', takes_here
    ) order by takes_here desc, film_count desc nulls last), '[]'::jsonb)
    from (
      select mt.title, mt.slug, mt.film_count, count(*) takes_here
      from tk join meta_takes mt on mt.id = tk.trope_id
      where mt.status='published' and mt.kind='figure_type'
      group by mt.title, mt.slug, mt.film_count
      order by takes_here desc, mt.film_count desc nulls last
      limit 14
    ) tt
  ),
  'films', (
    select coalesce(jsonb_agg(obj order by strength desc nulls last), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'title', f.title, 'year', f.year, 'director', f.director, 'slug', f.slug,
        'poster', f.poster_path, 'via', d.fig_label, 'figureSlug', d.fig_slug, 'takeTitle', d.take_title
      ) obj, d.strength
      from (
        select distinct on (film_id) film_id, fig_label, fig_slug, take_title, strength
        from tk order by film_id, strength desc nulls last
      ) d
      join films f on f.id = d.film_id
      order by d.strength desc nulls last
      limit 24
    ) fz
  ),
  'related', (
    select coalesce(jsonb_agg(jsonb_build_object('name', rn, 'native', rnat, 'slug', rslug, 'n', shared) order by shared desc), '[]'::jsonb)
    from (
      select c2.canon_slug rslug, max(c2.canon_name) rn,
        (select native from sm_concepts s3 where s3.canon_slug = c2.canon_slug and native is not null order by n desc limit 1) rnat,
        count(distinct fig.film_id) shared
      from takes t2
      join figures fig on fig.id = t2.figure_id and fig.film_id in (select film_id from myfilms)
      join sm_concepts c2 on exists (select 1 from public.concept_map k8 where k8.raw_l = lower(btrim(t2.concept)) and k8.concept_id = c2.id)
      where t2.status='published' and c2.canon_slug is distinct from (select canon_slug from res)
      group by c2.canon_slug
      order by shared desc
      limit 6
    ) r
  )
) end
$function$;
