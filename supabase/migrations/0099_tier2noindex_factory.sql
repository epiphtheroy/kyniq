-- 0099_tier2noindex_factory.sql — helper RPCs for the Tier-2 noindex factory (signal-recovery line).
-- The gate (canon: lib/seo.ts filmIndexBar): (n_reception>=3 OR n_lineage>=3 OR n_wd_honors>=3)
-- AND n_providers>=1 AND slug NOT LIKE 'tmdb-%'. This line recovers reception/honors signals for
-- noindex Tier-2 films that HAVE availability (nprov>=1) — the only ones a signal lever can lift.
-- Measured reality (2026-07-15 pilot n=100): reception>=3 crosses ~20%; awards max out at 2 (never
-- reach the >=3 threshold) so they add page content but rarely cross; provider=0 films are gated by
-- availability and are NOT addressable here (their film_watch_providers is empty — a TMDB re-fetch
-- problem, not a signal problem).

create table if not exists public.z_t2noindex_cohort (
  film_id uuid primary key,
  slug text,
  has_imdb boolean,
  wikidata_id text,
  nrec int, nlin int, nwd int, nprov int
);
alter table public.z_t2noindex_cohort enable row level security;  -- service_role only (no policies)

-- Rebuild the addressable cohort (noindex Tier-2 WITH availability). Returns the row count.
create or replace function public.t2noindex_refresh()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.z_t2noindex_cohort;
  insert into public.z_t2noindex_cohort (film_id, slug, has_imdb, wikidata_id, nrec, nlin, nwd, nprov)
  with s as (
    select f.id film_id, f.slug, (f.imdb_id is not null) has_imdb, f.wikidata_id,
      coalesce(r.n,0) nrec, coalesce(l.n,0) nlin, coalesce(w.n,0) nwd, coalesce(p.n,0) nprov
    from public.films f
    left join (select film_id,count(*)::int n from public.film_reception group by 1) r on r.film_id=f.id
    left join (select film_id,count(*)::int n from public.film_lineage    group by 1) l on l.film_id=f.id
    left join (select film_id,count(*)::int n from public.film_wd_honors   group by 1) w on w.film_id=f.id
    left join (select film_id,count(*)::int n from public.film_provider_index group by 1) p on p.film_id=f.id
    where not coalesce(f.is_analyzed,false)
  )
  select film_id, slug, has_imdb, wikidata_id, nrec, nlin, nwd, nprov from s
  where not ((nrec>=3 or nlin>=3 or nwd>=3) and nprov>=1)   -- currently noindex
    and nprov>=1 and slug not like 'tmdb-%';                -- addressable (has availability, resolved)
  get diagnostics n = row_count; return n;
end; $$;

-- Snapshot the whole Tier-2 index picture (for the before/after report). Mirrors filmIndexBar.
create or replace function public.t2noindex_measure()
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select f.slug,
      coalesce(r.n,0) nrec, coalesce(l.n,0) nlin, coalesce(w.n,0) nwd, coalesce(p.n,0) nprov
    from public.films f
    left join (select film_id,count(*)::int n from public.film_reception group by 1) r on r.film_id=f.id
    left join (select film_id,count(*)::int n from public.film_lineage    group by 1) l on l.film_id=f.id
    left join (select film_id,count(*)::int n from public.film_wd_honors   group by 1) w on w.film_id=f.id
    left join (select film_id,count(*)::int n from public.film_provider_index group by 1) p on p.film_id=f.id
    where not coalesce(f.is_analyzed,false)
  )
  select jsonb_build_object(
    'tier2_total', count(*),
    'idx_pass',            count(*) filter (where (nrec>=3 or nlin>=3 or nwd>=3) and nprov>=1 and slug not like 'tmdb-%'),
    'noindex',             count(*) filter (where not ((nrec>=3 or nlin>=3 or nwd>=3) and nprov>=1)),
    'addressable_noindex', count(*) filter (where not ((nrec>=3 or nlin>=3 or nwd>=3) and nprov>=1) and nprov>=1 and slug not like 'tmdb-%'),
    'provider_blocked',    count(*) filter (where nprov=0 and slug not like 'tmdb-%')
  ) from s;
$$;

grant execute on function public.t2noindex_refresh() to service_role;
grant execute on function public.t2noindex_measure() to service_role;
