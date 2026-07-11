-- 0072 — Home v8 phase 2: "Today at Metatake" daily exhibits.
-- home_daily_exhibits(p_seed): one jsonb row with up to 6 tiles, each md5-picked
-- from its pool by a DAY seed (YYYYMMDD) so a tile holds all day, then rotates.
-- Every tile samples a different content LAYER (film / reception-reversal /
-- question / shooting-place / strong-misreading / counterpoint) — the layers the
-- home did not surface. Null tile => layer empty that day (component omits it).
-- LLM-0, all from existing tables. Each tile PICKS ITS ROW FIRST, then joins the
-- detail laterally, so the heavy per-row work runs once (not over the pool).
-- Spec: docs/PLAN-home-v8-rotation.md §7.
create or replace function public.home_daily_exhibits(p_seed text default 'x')
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
 set statement_timeout to '20s'
as $function$
with sd as (select coalesce(nullif(p_seed,''),'x') as seed)
select jsonb_build_object(

  -- film of the day: any analyzed, scored, postered film
  'film', (
    select jsonb_build_object(
      'slug', f.slug, 'title', f.title, 'year', f.year, 'director', f.director,
      'poster', f.poster_path, 'backdrop', f.backdrop_path,
      'ts', round(s.v_value - s.r_risk)::int, 'tsv', round(s.v_value)::int, 'tsr', round(s.r_risk)::int)
    from films f
    join cinecodex.scores s on s.film_id=f.id
    where f.visible and f.is_analyzed and f.poster_path is not null and s.v_value is not null
    order by md5((select seed from sd) || f.slug) limit 1
  ),

  -- reversal of the day: a film whose reception spans >= 5 years (early vs late)
  'reversal', (
    select jsonb_build_object(
      'slug', c.slug, 'title', c.title, 'year', c.year, 'poster', c.poster_path,
      'y1', c.miny, 'v1', left(coalesce(nullif(btrim(lo.verdict),''), lo.outlet, ''), 70),
      'y2', c.maxy, 'v2', left(coalesce(nullif(btrim(hi.verdict),''), hi.outlet, ''), 70))
    from (
      select rr.film_id, f.slug, f.title, f.year, f.poster_path, rr.miny, rr.maxy
      from (
        select film_id, min(review_year) miny, max(review_year) maxy
        from film_reception where review_year is not null
        group by film_id having max(review_year)-min(review_year) >= 5
      ) rr
      join films f on f.id=rr.film_id and f.visible and f.poster_path is not null
      order by md5((select seed from sd) || f.slug) limit 1
    ) c
    join lateral (select verdict, outlet from film_reception where film_id=c.film_id and review_year=c.miny order by id limit 1) lo on true
    join lateral (select verdict, outlet from film_reception where film_id=c.film_id and review_year=c.maxy order by id limit 1) hi on true
  ),

  -- question of the day: a published, spoiler-safe curious question
  'question', (
    select jsonb_build_object(
      'title', coalesce(q.display_title, q.safe_hook, q.title),
      'fslug', f.slug, 'qslug', q.slug, 'film', f.title, 'year', f.year, 'poster', f.poster_path)
    from questions q
    join films f on f.id=q.film_id and f.visible
    where q.status='published' and q.spoiler_level <> 'major'
      and coalesce(q.display_title, q.safe_hook, q.title) is not null
    order by md5((select seed from sd) || q.slug) limit 1
  ),

  -- place of the day: a mapped shooting location
  'place', (
    select jsonb_build_object(
      'place', l.name, 'fslug', f.slug, 'film', f.title, 'year', f.year, 'poster', f.poster_path)
    from film_locations l
    join films f on f.id=l.film_id and f.visible and f.poster_path is not null
    where l.name is not null and length(btrim(l.name)) > 1
    order by md5((select seed from sd) || l.name || f.slug) limit 1
  ),

  -- misreading of the day: a film with >= 5 published readings (article gate)
  'misreading', (
    select jsonb_build_object(
      'slug', c.slug, 'title', c.title, 'year', c.year, 'poster', c.poster_path, 'trope', mt.title)
    from (
      select f.id, f.slug, f.title, f.year, f.poster_path
      from films f
      join (
        select g.film_id from takes t join figures g on g.id=t.figure_id
        where t.status='published' and t.is_invitation=false
        group by g.film_id having count(*) >= 5
      ) rc on rc.film_id=f.id
      where f.visible and f.is_analyzed and f.poster_path is not null
      order by md5((select seed from sd) || 'mis' || f.slug) limit 1
    ) c
    left join lateral (
      select m.title from figure_type_members ftm
      join figures g2 on g2.id=ftm.figure_id
      join meta_takes m on m.id=ftm.meta_take_id
      where g2.film_id=c.id and m.status='published' and m.kind='figure_type'
      order by m.film_count desc nulls last limit 1
    ) mt on true
  ),

  -- counterpoint of the day: a trope staged across >= 2 films (the pair)
  'counterpoint', (
    select jsonb_build_object(
      'slug', c.slug, 'trope', c.title,
      'a', jsonb_build_object('f', pr.titles[1], 'fs', pr.slugs[1]),
      'b', jsonb_build_object('f', pr.titles[2], 'fs', pr.slugs[2]))
    from (
      select m.id, m.slug, m.title from meta_takes m
      join trope_counts tc on tc.meta_take_id=m.id
      where m.status='published' and m.kind='figure_type' and tc.films >= 2
      order by md5((select seed from sd) || m.slug) limit 1
    ) c
    cross join lateral (
      select array_agg(x.title) titles, array_agg(x.slug) slugs from (
        select distinct on (f.id) f.title, f.slug
        from figure_type_members ftm
        join figures g on g.id=ftm.figure_id
        join films f on f.id=g.film_id
        where ftm.meta_take_id=c.id and f.visible order by f.id limit 2
      ) x
    ) pr
    where array_length(pr.slugs,1) >= 2
  )

);
$function$;
