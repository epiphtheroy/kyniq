-- 0038 (P2+P6): directors_catalogue_v2 — jsonb single row (cap-proof, same
-- pattern as films_catalogue_v2), with two upgrades over v1:
--   · country: normalized via director_country() (0036); NULL when unknown —
--     the UI omits the badge instead of exhibiting 'Unknown'/'Ukraine]' etc.
--   · sig: the director's top signature trope (recurs across ≥2 visible films,
--     same aggregation the featured cards use) — derived from existing data,
--     never generated copy. NULL when the filmography doesn't support one.
-- directors_catalogue (v1) is left in place until all callers are migrated.

create or replace function public.directors_catalogue_v2()
returns jsonb
language sql
stable
set search_path to 'public'
set statement_timeout to '15s'
as $$
  with d as (
    select f.director_slug as slug, max(f.director) as dname, count(*)::int as films
    from films f
    where f.visible and f.director_slug is not null
    group by f.director_slug
  ),
  sig as (
    select s.director_slug, s.title from (
      select f.director_slug, mt.title,
             row_number() over (partition by f.director_slug
                                order by count(distinct f.id) desc, mt.title) as rn
      from films f
        join figures fg on fg.film_id = f.id and fg.status = 'approved'
        join figure_type_members ftm on ftm.figure_id = fg.id
        join meta_takes mt on mt.id = ftm.meta_take_id
      where f.visible and f.director_slug is not null
        and mt.status = 'published' and mt.kind = 'figure_type'
      group by f.director_slug, mt.id, mt.title
      having count(distinct f.id) >= 2
    ) s where s.rn = 1
  )
  select jsonb_build_object(
    'total', (select count(*) from d),
    'items', coalesce(jsonb_agg(jsonb_build_object(
        'slug', d.slug,
        'name', coalesce(dr.name, d.dname),
        'country', director_country(dr.place_of_birth),
        'films', d.films,
        'sig', sig.title
      ) order by coalesce(dr.name, d.dname)), '[]'::jsonb)
  )
  from d
  left join directors dr on dr.slug = d.slug
  left join sig on sig.director_slug = d.slug;
$$;
