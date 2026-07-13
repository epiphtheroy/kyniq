-- 0096_api_locations.sql — filming-locations geodata for the public REST API (2026-07-13)
--
-- Powers GET /api/v1/locations and the open CC BY dataset export. This is the
-- deliberate reversal of the pack's "no coordinates" rule (HANDOFF-컨텍스트팩 §5):
-- the owner chose to PUBLISH the filming-location geodata as an open, attributed
-- asset (backlinks + academic citation) rather than hoard it as a paid edge.
-- The PACK product stays coordinate-free; coordinates leave ONLY through this
-- explicitly-open channel. See HANDOFF-MCP-서버.md / the AI-visibility handoff.
--
-- Service-role only (reached through the app route, which carries the harvest
-- guard). jsonb single-row to dodge the PostgREST 1000-row cap.

create or replace function public.api_locations_json(
  p_film    text default null,   -- film slug filter
  p_country text default null,   -- country filter (ILIKE)
  p_limit   int  default 50      -- clamped to [1, 200]
)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with rows as (
    select f.slug as film_slug, f.title as film_title, f.year as film_year,
           l.name, l.scene_role as role, l.narrative_setting, l.layer, l.kind,
           l.country, l.lat, l.lng, l.precision, l.confidence
    from film_locations l
    join films f on f.id = l.film_id
    where coalesce(f.visible, true) = true
      and l.name is not null
      and (p_film is null or f.slug = p_film)
      and (p_country is null or l.country ilike p_country)
    order by f.year desc nulls last, l.id
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  )
  select jsonb_build_object(
    'count', (select count(*) from rows),
    'locations', coalesce((select jsonb_agg(to_jsonb(rows)) from rows), '[]'::jsonb)
  );
$$;

revoke execute on function public.api_locations_json(text, text, int) from public, anon, authenticated;
grant  execute on function public.api_locations_json(text, text, int) to service_role;

-- Full dataset export (CC BY publication) — no film/limit filter, coordinates
-- present. Keyset pagination on the uuid id (stable order); the exporter passes
-- back next_after until it is null.
create or replace function public.api_locations_export(p_after text default null, p_limit int default 1000)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with rows as (
    select l.id, f.slug as film_slug, f.title as film_title, f.year as film_year,
           f.imdb_id, f.tmdb_id,
           l.name, l.scene_role as role, l.narrative_setting, l.layer, l.kind,
           l.country, l.lat, l.lng, l.precision, l.confidence
    from film_locations l
    join films f on f.id = l.film_id
    where coalesce(f.visible, true) = true
      and l.name is not null
      and (p_after is null or p_after = '' or l.id > p_after::uuid)
    order by l.id
    limit least(greatest(coalesce(p_limit, 1000), 1), 5000)
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg((to_jsonb(rows) - 'id')) from rows), '[]'::jsonb),
    'next_after', (select id::text from rows order by id desc limit 1)
  );
$$;

revoke execute on function public.api_locations_export(text, int) from public, anon, authenticated;
grant  execute on function public.api_locations_export(text, int) to service_role;
