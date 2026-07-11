-- 0075 · thumbnails for the redesigned /film and /director index catalogues.
-- The A–Z index now shows a poster (films) / circular face (directors) per row,
-- so the catalogue jsonb needs the image path. Additive only — same shape as
-- 0037/0038 plus one field. 'poster'/'photo' are TMDB paths (nullable).

create or replace function public.films_catalogue_v2()
returns jsonb
language sql
stable
set search_path to 'public'
set statement_timeout to '15s'
as $$
  with c as (
    select f.slug, f.title, f.year::int as year, f.director,
           coalesce(f.genres[1], '—') as genre, f.poster_path as poster
    from films f
    where f.visible
  )
  select jsonb_build_object(
    'total', (select count(*) from c),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'slug', slug, 'title', title, 'year', year, 'director', director,
      'genre', genre, 'poster', poster
    ) order by title), '[]'::jsonb)
  )
  from c;
$$;

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
        'sig', sig.title,
        'photo', dr.profile_path
      ) order by coalesce(dr.name, d.dname)), '[]'::jsonb)
  )
  from d
  left join directors dr on dr.slug = d.slug
  left join sig on sig.director_slug = d.slug;
$$;
