-- 0117 — production-country counts for the app's country filter (owner 07-30).
--
-- Purely ADDITIVE: a new read-only function. It does NOT touch cinecodex_ranked,
-- which the website's what-to-watch, the screener and the app all share — the
-- filter itself rides that RPC's existing p_country argument untouched.
--
-- Why a function at all: the counts live in curation.film, and the `curation`
-- schema is not exposed through PostgREST (a direct REST read returns 406). The
-- alternative was fanning out one cinecodex_ranked call per country just to read
-- its `total`, which is a full ranking query each time — this is one scan.
--
-- Counts are the same population the filter selects: p_country compares against
-- curation.film.country_code, so ordering by these counts orders the picker by
-- how many films each country will actually yield.

create or replace function public.film_country_counts()
returns table (country_code text, film_count integer)
language sql
stable
security definer
set search_path = public, curation
as $$
  select cf.country_code::text,
         count(*)::integer as film_count
    from curation.film cf
   where cf.country_code is not null
     and cf.country_code <> ''
   group by cf.country_code
   order by film_count desc, cf.country_code
$$;

comment on function public.film_country_counts() is
  'Production-country film counts (curation.film.country_code) for the app country picker. Read-only; ordered by count desc.';

revoke all on function public.film_country_counts() from public;
grant execute on function public.film_country_counts() to anon, authenticated, service_role;
