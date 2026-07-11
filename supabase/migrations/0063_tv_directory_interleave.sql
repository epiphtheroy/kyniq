-- 0063_tv_directory_interleave.sql — vary the /tv/lists (and /tv embed) default
-- order so topic-cuts (60-film genre×topic lists) no longer dominate the top.
-- With no axis filter, interleave axes by their within-axis rank (director#1,
-- lineage#1, trope#1 … then #2 …) led by a curated axis priority; with an axis
-- filter, plain n_films desc. Signature unchanged (safe CREATE OR REPLACE).
create or replace function public.tv_directory(p_axis text default null, p_q text default null, p_limit int default 60, p_offset int default 0)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with base as (
    select slug, title, dek, kind, axis, cut, n_films, n_segments, total_ms, href,
      case axis
        when 'lineage' then 1 when 'director' then 2 when 'genre' then 3 when 'country' then 4
        when 'decade' then 5 when 'theorist' then 6 when 'trope' then 7 when 'concept' then 8
        when 'archetype' then 9 when 'genre_topic' then 10 else 11 end axp,
      row_number() over (partition by axis order by n_films desc nulls last, title) rn
    from tv_playlists
    where (p_axis is null or axis = p_axis) and (p_q is null or title ilike '%'||p_q||'%')
  ),
  ordered as (
    select *, row_number() over (
      order by (case when p_axis is null then rn else 0 end), axp, n_films desc nulls last, title
    ) grank
    from base
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'lists', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', slug, 'title', title, 'dek', dek, 'kind', kind, 'axis', axis, 'cut', cut,
        'n_films', n_films, 'n_segments', n_segments, 'total_ms', total_ms, 'href', href) order by grank)
      from ordered
      where grank > greatest(p_offset, 0) and grank <= greatest(p_offset, 0) + least(greatest(p_limit, 1), 120)
    ), '[]'::jsonb))
$$;
