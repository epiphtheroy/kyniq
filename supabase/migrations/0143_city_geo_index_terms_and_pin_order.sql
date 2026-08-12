-- city_geo timed out in production on six southern-California city pages in a
-- single burst (2026-08-12 13:55:45Z, release ebcb23a3): san-fernando-valley,
-- agua-dulce, victorville, culver-city, hollywood-hills, inglewood. Two mistakes
-- in 0142, and a third in how it was checked.
--
-- 1. SHAPE. 0142 materialized `near` — country plus the 250 km radius — and only
--    then tested the locality terms. Materializing forces that order, so the term
--    test ran against a CTE instead of the table and no index could ever serve
--    it. Victorville returns four pins but sits in the middle of southern
--    California: 3,084 pins fall inside its radius, and every one of them paid
--    for a regexp_split_to_table, a window function and an aggregate.
--    Fixed by putting all three predicates in one scan and indexing the terms, so
--    the selective predicate leads: victorville 174 ms -> 6.7 ms, five rows off a
--    bitmap index scan instead of 3,084 extractions.
--
-- 2. ORDER. Indexing the terms changed the scan, and paris came back with the
--    same 847 pins in a different sequence. That order is not cosmetic —
--    mergePins() fuses duplicates by first appearance, so it decides which row's
--    name and prose survive and how a film's places are listed. This is migration
--    0125's lesson again: a result ordered by the scan is a result that changes
--    when the planner does. ctid is the physical order these pages have always
--    rendered in, and the aggregate now orders by it explicitly rather than
--    trusting the CTE's order to survive the joins above it.
--
-- 3. MEASUREMENT. 0142 was timed on one city against an idle database — 190 ms,
--    which read as plenty of headroom. The cost is CPU, not I/O, so it stretches
--    under load, and the one city measured was not the worst. All 511 cities are
--    now timed: p50 57 ms, p90 124 ms, p99 152 ms, max 404 ms (los-angeles).
--
-- Re-verified after both changes: all 511 cities against the pre-0142 path —
-- 378 identical down to pin order, 133 US cities holding the pins the old
-- `limit 8000` had dropped, 0 cities losing a pin, 0 ordering differences.
--
-- Applied to production 2026-08-13 (supabase_migrations names:
-- city_geo_index_terms_and_single_scan, city_geo_explicit_pin_order).

create index if not exists film_locations_locality_terms_gin
  on public.film_locations
  using gin (pin_locality_terms(name, kind, country));

analyze public.film_locations;

create or replace function public.city_geo(
  p_country text,
  p_lat double precision,
  p_lng double precision,
  p_terms text[],
  p_km double precision default 250
)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
set work_mem to '16MB'
as $function$
  with member as materialized (
    -- One scan, all three predicates: the terms are indexed and selective, so
    -- they lead and the arithmetic runs on what is left. Do NOT split this back
    -- into a country/radius CTE feeding a term filter — that is what timed out.
    select l.*, row_number() over (order by l.ctid) as _ord
    from film_locations l
    where l.lat is not null
      and pin_locality_terms(l.name, l.kind, l.country) && p_terms
      and l.country = p_country
      and sqrt(pow((l.lat - p_lat) * 111.0, 2)
             + pow((l.lng - p_lng) * 111.0 * cos(radians(l.lat)), 2)) <= p_km
  )
  select coalesce(jsonb_agg(to_jsonb(t) - '_ord' order by t._ord), '[]'::jsonb)
  from (
    select l._ord,
           l.id, l.name,
           left(coalesce(l.narrative_setting, ''), 240) as narrative_setting,
           left(coalesce(l.scene_role, ''), 240) as scene_role,
           l.kind, l.lat, l.lng, l.country, l.layer,
           l.built_set, l.set_host, l.tier,
           case when jsonb_typeof(l.sources) = 'array' and jsonb_array_length(l.sources) > 0
                then jsonb_build_array(l.sources->0) else null end as sources,
           fm.slug as film_slug, fm.title as film_title, fm.year as film_year,
           fm.director, fm.director_slug,
           f.slug as fig_slug, left(coalesce(f.description, ''), 240) as fig_desc,
           fm.poster_path
    from member l
    join films fm on fm.id = l.film_id
    left join figures f on f.id = l.figure_id
  ) t;
$function$;
