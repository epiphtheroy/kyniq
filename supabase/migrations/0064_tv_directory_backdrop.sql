-- 0064_tv_directory_backdrop.sql — add a representative film backdrop to each
-- directory row so the browse cards can show a thumbnail (dark, image-backed)
-- instead of flat white panels. Backdrop = the first item's film backdrop
-- (works for both films-cut and segments-cut playlists). Keeps the interleaved
-- ordering from 0063. Signature unchanged.
create or replace function public.tv_directory(p_axis text default null, p_q text default null, p_limit int default 60, p_offset int default 0)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with base as (
    select id, slug, title, dek, kind, axis, cut, n_films, n_segments, total_ms, href,
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
        'slug', o.slug, 'title', o.title, 'dek', o.dek, 'kind', o.kind, 'axis', o.axis, 'cut', o.cut,
        'n_films', o.n_films, 'n_segments', o.n_segments, 'total_ms', o.total_ms, 'href', o.href,
        'backdrop', (
          select f.backdrop_path
          from tv_playlist_items i
          left join tv_programs pp on pp.id = i.program_id
          left join tv_segments s on s.id = i.segment_id
          left join tv_programs sp on sp.id = s.program_id
          join films f on f.id = coalesce(pp.film_id, sp.film_id)
          where i.playlist_id = o.id and f.backdrop_path is not null
          order by i.pos
          limit 1
        )) order by o.grank)
      from ordered o
      where o.grank > greatest(p_offset, 0) and o.grank <= greatest(p_offset, 0) + least(greatest(p_limit, 1), 120)
    ), '[]'::jsonb))
$$;
