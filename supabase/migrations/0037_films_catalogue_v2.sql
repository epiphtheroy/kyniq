-- 0037 (P3): films_catalogue_v2 — the /film index catalogue as a single jsonb row.
-- The TABLE-returning films_catalogue silently truncates at PostgREST's 1000-row
-- cap (1,935 visible films → 1,000 shown, 935 unreachable from the index).
-- jsonb_agg in one row bypasses the cap; 'total' is the DB-real count so the
-- page never hardcodes or disagrees with the nav badge (nav_counts uses the
-- same predicate: films where visible).
-- films_catalogue (v1) is left in place until all callers are migrated.

create or replace function public.films_catalogue_v2()
returns jsonb
language sql
stable
set search_path to 'public'
set statement_timeout to '15s'
as $$
  with c as (
    select f.slug, f.title, f.year::int as year, f.director,
           coalesce(f.genres[1], '—') as genre
    from films f
    where f.visible
  )
  select jsonb_build_object(
    'total', (select count(*) from c),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'slug', slug, 'title', title, 'year', year, 'director', director, 'genre', genre
    ) order by title), '[]'::jsonb)
  )
  from c;
$$;
