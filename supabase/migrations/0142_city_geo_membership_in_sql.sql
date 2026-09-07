-- City membership moves from the page process into SQL.
--
-- /locations/<country>/<city> used to load every pin in the country and filter it
-- down in JavaScript. For the United States that dump is 5.1 MB, over Vercel's
-- 2 MB Data Cache ceiling, so it was never cached and every render re-ran the
-- query — 595 statement timeouts and a 500 apiece between 08-04 and 08-12. And
-- country_geo caps at `limit 8000` with no ORDER BY, so 1,981 of that country's
-- 9,981 pins were dropped in whatever order the scan produced: a US city could
-- silently gain or lose films when the plan changed.
--
-- Two functions. pin_locality_terms is the SQL twin of pinLocalityTerms() in
-- lib/locations.ts; city_geo applies the same three predicates as
-- cityMemberPins() in the same order.
--
-- Verified before wiring:
--   * pin_locality_terms vs the TypeScript over all 28,412 pins — 0 mismatches.
--   * city_geo vs cityMemberPins(country_geo(...)) over all 511 cities —
--     378 identical down to pin order, 133 US cities gained pins the cap had
--     been dropping, 0 cities lost a pin, 0 ordering differences.
--   * widest city (new-york) 1,460 pins / 930 kB — every city now fits the
--     Data Cache it never fit before.
--
-- Applied to production 2026-08-12 (supabase_migrations names:
-- pin_locality_terms_helper, city_geo_push_membership_into_sql).

-- pin_locality_terms — the SQL twin of pinLocalityTerms() in lib/locations.ts.
--
-- It deliberately does NOT reuse the rule inside atlas_city_candidates_json,
-- which looks equivalent and is not: that one keeps the first segment when
-- `name not like '%,%'`, while the TypeScript keeps it when the name has fewer
-- than two NON-EMPTY comma segments. "Foo," parses as one part in TypeScript and
-- as a comma-bearing name in SQL. The roster JSON was built with the candidates
-- rule; live membership is decided by this one, so this one mirrors TypeScript.

create or replace function public.pin_locality_terms(p_name text, p_kind text, p_country text)
returns text[]
language sql
immutable
as $function$
  with raw as (
    select trim(s.seg) as seg, s.o as o
    from regexp_split_to_table(coalesce(p_name, ''), ',') with ordinality as s(seg, o)
  ),
  parts as (
    -- .filter(Boolean) drops empty segments BEFORE the head is counted or sliced,
    -- so the ordinal the slice tests has to be renumbered after that filter.
    select seg, row_number() over (order by o) as ord
    from raw
    where seg <> ''
  ),
  kept as (
    select p.seg, p.ord
    from parts p
    where p_kind is not distinct from 'city'
       or (select count(*) from parts) <= 1
       or p.ord > 1
  )
  select coalesce(array_agg(lower(seg) order by ord), '{}'::text[])
  from kept
  where length(lower(seg)) >= 3
    and lower(seg) !~ '[0-9]'
    and lower(seg) <> lower(coalesce(p_country, ''))
    and lower(seg) not in (
      'usa', 'u.s.a.', 'u.s.', 'uk', 'u.k.', 'united states',
      'united states of america', 'united kingdom', 'czech republic',
      'holland', 'republic of ireland', 'republic of korea'
    );
$function$;

-- city_geo — the same three predicates as cityMemberPins(), in the same order,
-- against the same distance formula (note the cosine takes the PIN's latitude,
-- not the city's — kmBetween's first argument). The country + radius test is
-- cheap arithmetic and runs first; only the survivors pay for term extraction.
--
-- No row cap: the radius bounds the result where `limit 8000` never could.

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
  with near as materialized (
    select l.*
    from film_locations l
    where l.lat is not null
      and l.country = p_country
      and sqrt(pow((l.lat - p_lat) * 111.0, 2)
             + pow((l.lng - p_lng) * 111.0 * cos(radians(l.lat)), 2)) <= p_km
  ),
  member as (
    select * from near
    where pin_locality_terms(name, kind, country) && p_terms
  )
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  from (
    select l.id, l.name,
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
