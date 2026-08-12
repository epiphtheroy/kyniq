-- country_geo: 8,000 pins were being joined to films one row at a time.
--
-- The filtered pins fed a nested loop straight into films_pkey, so the plan paid
-- 8,000 separate index descents — 24,000 of the query's 25,448 buffers — and the
-- planner never placed a Memoize above them. Warm that costs 275 ms and hides;
-- cold, on a database under crawl load, 24,000 random reads is what pushed the
-- statement past anon's 3 s ceiling and turned every /locations/<country>/<city>
-- page into a 500. 595 of them since 2026-08-04, still firing on 08-12.
--
-- Materializing the filtered pins first lets the planner memoize the film lookup
-- (6,170 hits / 1,830 misses on united-states), which is the same answer built
-- from 6,941 buffers instead of 25,448.
--
-- Deliberately NOT indexed: the country-slug expression could be an expression
-- index, but the filter is a 63 ms scan of a 19 MB table and turning it into an
-- index scan would reorder the rows feeding `limit 8000` — silently changing
-- which 8,000 of united-states' 9,981 pins the city pages see. Same trap as
-- migration 0125. The scan stays; the truncation is a separate decision.
--
-- Verified byte-identical: md5 of the jsonb payload matches the previous
-- definition for united-states, united-kingdom, france, italy, japan,
-- south-korea, china, mexico, iceland, and a slug with no pins.
--
-- Applied to production 2026-08-12 (supabase_migrations name:
-- country_geo_materialize_pins_before_join).

create or replace function public.country_geo(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
set work_mem to '16MB'
as $function$
  with picked as materialized (
    select l.*
    from film_locations l
    where l.lat is not null
      and trim(both '-' from lower(regexp_replace(l.country, '[^a-zA-Z0-9]+', '-', 'g'))) = p_slug
    limit 8000
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
    from picked l
    join films fm on fm.id = l.film_id
    left join figures f on f.id = l.figure_id
  ) t;
$function$;
