-- 0074 · tv_recommend — "watch next" for METATAKE TV, with reasons.
--
-- Reuses the movies-like engine (film_affinities: score + shared figure-type
-- meta_takes) but returns only films that HAVE a published broadcast, shaped
-- for the watch surfaces. Each rec carries `because` (up to 3 shared
-- figure/trope titles) and `same_director` so the front end can say WHY.
-- Fallback when a film has no affinity rows: other broadcasts by the director.

create or replace function public.tv_recommend(p_program text, p_cap int default 10)
returns jsonb language sql stable security definer set search_path to 'public'
set statement_timeout to '12s' as $$
with me as (
  select p.film_id, f.director_slug
  from tv_programs p join films f on f.id = p.film_id
  where p.slug = p_program and p.status = 'published'
  limit 1
),
aff as (
  select a.related_film_id, a.score, a.shared_meta_take_ids
  from film_affinities a join me on a.film_id = me.film_id
  order by a.score desc
  limit 40
),
hits as (
  select p.slug, p.title, p.dek, p.seg_count, p.duration_ms, a.score,
    a.shared_meta_take_ids,
    (me.director_slug is not null and f.director_slug = me.director_slug) same_director,
    f.director,
    jsonb_build_object('title', f.title, 'year', f.year, 'slug', f.slug, 'director', f.director,
      'director_slug', f.director_slug, 'poster', f.poster_path, 'backdrop', f.backdrop_path) film
  from aff a
  join films f on f.id = a.related_film_id and coalesce(f.visible, true)
  join tv_programs p on p.film_id = f.id and p.status = 'published'
  cross join me
  order by a.score desc
  limit greatest(coalesce(p_cap, 10), 1)
),
fallback as (
  select p.slug, p.title, p.dek, p.seg_count, p.duration_ms, 0.0::numeric score,
    array[]::uuid[] shared_meta_take_ids, true same_director, f.director,
    jsonb_build_object('title', f.title, 'year', f.year, 'slug', f.slug, 'director', f.director,
      'director_slug', f.director_slug, 'poster', f.poster_path, 'backdrop', f.backdrop_path) film
  from me
  join films f on f.director_slug = me.director_slug and f.id <> me.film_id and coalesce(f.visible, true)
  join tv_programs p on p.film_id = f.id and p.status = 'published'
  where me.director_slug is not null and not exists (select 1 from hits)
  limit greatest(coalesce(p_cap, 10), 1)
),
alldata as (select * from hits union all select * from fallback)
select jsonb_build_object('recs', coalesce((select jsonb_agg(jsonb_build_object(
  'slug', d.slug, 'title', d.title, 'dek', d.dek, 'seg_count', d.seg_count, 'duration_ms', d.duration_ms,
  'film', d.film, 'same_director', d.same_director, 'director', d.director,
  'because', coalesce((
     select jsonb_agg(mt.title order by s.ord)
     from (select u.id, u.ord from unnest(d.shared_meta_take_ids) with ordinality u(id, ord) limit 3) s
     join meta_takes mt on mt.id = s.id and mt.status = 'published' and mt.kind = 'figure_type'
  ), '[]'::jsonb)
) order by d.score desc) from alldata d), '[]'::jsonb))
$$;

grant execute on function public.tv_recommend(text, int) to anon, authenticated;
