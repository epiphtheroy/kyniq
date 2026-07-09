-- 0051_reel_cards.sql
-- Feed for the 30-second "reel" prototype (/random/reel): N random analyzed films
-- that each have a backdrop and a strong misreading, returned with a punchy
-- headline (take_title) + the leap for narration. One jsonb array, one round-trip.
create or replace function public.reel_cards(p_n int default 5)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select jsonb_agg(c) from (
    select jsonb_build_object(
      'title', f.title, 'year', f.year, 'director', f.director, 'slug', f.slug,
      'backdrop', f.backdrop_path,
      'line', t.take_title, 'framework', t.framework, 'leap', t.leap
    ) c
    from (
      select fi.id, fi.title, fi.year, fi.director, fi.slug, fi.backdrop_path
      from films fi
      where fi.visible and coalesce(fi.is_analyzed,true) and fi.backdrop_path is not null
        and exists(select 1 from figures g join takes tt on tt.figure_id=g.id
                   where g.film_id=fi.id and tt.status='published' and tt.take_title is not null)
      order by random() limit p_n
    ) f
    join lateral (
      select t.take_title, t.framework, t.leap
      from takes t join figures g on g.id=t.figure_id
      where g.film_id=f.id and t.status='published' and t.take_title is not null
      order by t.strength desc nulls last, random() limit 1
    ) t on true
  ) s;
$$;
