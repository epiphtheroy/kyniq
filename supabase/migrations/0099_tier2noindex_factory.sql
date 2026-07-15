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
  where not (nrec>=3 or nlin>=3 or nwd>=3) and slug not like 'tmdb-%';  -- weak-signal noindex; reception can lift. Availability no longer required (gate relaxed 2026-07-15 — see lib/seo.ts filmIndexBar).
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
    'idx_pass',                count(*) filter (where (nrec>=3 or nlin>=3 or nwd>=3) and slug not like 'tmdb-%'),
    'idx_pass_old_gate',       count(*) filter (where (nrec>=3 or nlin>=3 or nwd>=3) and nprov>=1 and slug not like 'tmdb-%'),
    'newly_indexed_provider0', count(*) filter (where (nrec>=3 or nlin>=3 or nwd>=3) and nprov=0 and slug not like 'tmdb-%'),
    'addressable_noindex',     count(*) filter (where not (nrec>=3 or nlin>=3 or nwd>=3) and slug not like 'tmdb-%'),
    'provider0_informational', count(*) filter (where nprov=0 and slug not like 'tmdb-%')
  ) from s;
$$;

-- Cohort films that NOW cross the (relaxed) gate — the daily wave revalidates exactly these.
create or replace function public.t2noindex_crossed_slugs()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.slug order by c.slug), '{}')
  from public.z_t2noindex_cohort c
  where (select count(*) from public.film_reception r where r.film_id=c.film_id) >= 3
     or (select count(*) from public.film_lineage  l where l.film_id=c.film_id) >= 3
     or (select count(*) from public.film_wd_honors w where w.film_id=c.film_id) >= 3;
$$;

-- Cohort films missing a given content layer — drives the content-parity enrich commands.
create or replace function public.t2noindex_missing(kind text)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.slug order by c.slug), '{}')
  from public.z_t2noindex_cohort c
  where case kind
    when 'locations' then not exists(select 1 from public.film_locations x where x.film_id=c.film_id)
    when 'awards'    then not exists(select 1 from public.film_wd_honors x where x.film_id=c.film_id)
    when 'takescore' then not exists(select 1 from cinecodex.scores x where x.film_id=c.film_id)  -- page reads cinecodex_for (raw), not public.film_scores (prestige/discovery only)
    when 'sentences' then not exists(select 1 from public.film_sentences x where x.film_id=c.film_id)
    when 'stills'    then (select count(*) from public.media m where m.entity_type='film' and m.entity_id=c.film_id) < 5
    else false end;
$$;

grant execute on function public.t2noindex_refresh() to service_role;
grant execute on function public.t2noindex_measure() to service_role;
grant execute on function public.t2noindex_crossed_slugs() to service_role;
grant execute on function public.t2noindex_missing(text) to service_role;
