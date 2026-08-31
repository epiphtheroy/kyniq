-- 0148 — atlas_eligibility_json: let catalogue (Tier-2) films into the FILM roster.
--
-- Why. /film/locations/[slug] was gated on films.visible in two places at once:
-- the page 404'd catalogue films, and this RPC withheld them from the sitemap.
-- Measured 2026-08-31, that hid 1,641 films holding ≥3 merged coordinate cells —
-- on the route the 30-day referrer log shows earning the most from Bing and
-- DuckDuckGo, the channel that now sends ~840 visitors a month against Google's
-- 15. A shooting location is a sourced production fact; it does not depend on
-- whether our criticism has reached the title.
--
-- Scope, deliberately narrow: ONLY the 'films' branch changes.
--   · 'directors' unchanged — the per-director locations page still speaks for a
--     read filmography, and widening it would silently reshape 331 pages.
--   · 'countries' unchanged — country hubs and the frozen city roster
--     (lib/atlas_cities.json) are built from the visible set; adding catalogue
--     films would change hub membership and orphan the artifact's ≥3-film bar.
--
-- Invariant preserved: the page renders iff mergeCells(pins) >= 3, and this RPC
-- counts the same rounded lat/lng cells at the same threshold, so an advertised
-- URL still cannot 404. Stubs (tmdb-%) stay out — they have no resolved title.
--
-- Exposure is controlled in code, not here: INDEX_COHORT_FILM_LOCATIONS caps the
-- sitemap slice (1,000 → 3,400 in the same release).

create or replace function public.atlas_eligibility_json()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'films', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.slug), '[]'::jsonb) from (
        select fm.slug, count(distinct (round(l.lat::numeric,3), round(l.lng::numeric,3))) as n
        from film_locations l join films fm on fm.id = l.film_id
        where l.lat is not null
          and fm.slug not like 'tmdb-%'
        group by fm.slug
        having count(distinct (round(l.lat::numeric,3), round(l.lng::numeric,3))) >= 3
      ) t),
    'directors', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.slug), '[]'::jsonb) from (
        select fm.director_slug as slug, count(distinct fm.id) as films,
               count(distinct (round(l.lat::numeric,3), round(l.lng::numeric,3))) as n
        from film_locations l join films fm on fm.id = l.film_id and fm.visible
        where l.lat is not null and fm.director_slug is not null
        group by fm.director_slug
        having count(distinct fm.id) >= 2
           and count(distinct (round(l.lat::numeric,3), round(l.lng::numeric,3))) >= 6
      ) t),
    'countries', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.pins desc), '[]'::jsonb) from (
        select l.country as name,
               trim(both '-' from lower(regexp_replace(l.country, '[^a-zA-Z0-9]+', '-', 'g'))) as slug,
               count(*) as pins, count(distinct l.film_id) as films
        from film_locations l join films fm on fm.id = l.film_id and fm.visible
        where l.lat is not null and l.country is not null and l.country <> ''
        group by 1, 2
        having count(*) >= 3 and count(distinct l.film_id) >= 3
      ) t)
  );
$function$;
