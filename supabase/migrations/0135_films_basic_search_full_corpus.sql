-- 0135_films_basic_search_full_corpus.sql — let search reach every scored film (2026-08-05)
--
-- The discovery surface and the content surface disagreed, and the gap was ~5,000 films:
--
--   films_basic_search (search_films / search / GET /api/v1/films)
--     gate: visible is distinct from false        → 1,959 films
--   film_context_pack  (get_film_criticism / fetch / get_takescore / v1 by slug)
--     gate: slug not like 'tmdb-%' AND (Tier-1 analyzed+visible OR Tier-2)  → 6,956 films
--
-- Tier-2 catalog films carry visible=false (all 5,177 of them), so search could never
-- surface one — yet every one of them has a TakeScore and a served pack. An assistant
-- that only had MCP would answer "Metatake doesn't have that film", while the same film's
-- pack was one fetch away for anyone who read the slug off the sitemap. 6,956 of 6,978
-- scored films now resolve by title/director search, TakeScore included (owner call,
-- 2026-08-05: "테이크스코어는 6천편 모두 되도록").
--
-- The gate is now character-for-character the pack's eligibility, so search never returns
-- a slug that fetch would 404 on. Still excluded, deliberately:
--   · slug like 'tmdb-%'      — 180 unresolved catalog stubs, no pack
--   · is_analyzed AND NOT visible — 22 deliberately withdrawn Tier-1 films
--
-- Ordering: coalesce(is_analyzed,false) desc, NOT `is_analyzed desc` — a null would sort
-- FIRST under DESC and float catalog stubs above analyzed films. There are no nulls today;
-- the gate admits them, so the order must not depend on that staying true. slug breaks
-- remaining ties for a total order (same rule as 0130).
--
-- Signature is unchanged (text, int) on purpose: adding a defaulted third argument would
-- create a SECOND function rather than replace this one, and PostgREST would 300 on the
-- ambiguity. Callers: app/api/mcp/route.ts, app/api/v1/films/route.ts.

create or replace function public.films_basic_search(p_q text, p_year int default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
    select slug, title, original_title, year, director, is_analyzed
    from films
    where slug not like 'tmdb-%'
      and ( (is_analyzed = true and visible = true)      -- Tier-1: full analysis + readings
         or (coalesce(is_analyzed, false) = false) )     -- Tier-2: catalog record + TakeScore
      and length(trim(coalesce(p_q, ''))) > 0
      and (
        unaccent(lower(title))                          like '%' || unaccent(lower(trim(p_q))) || '%'
        or unaccent(lower(coalesce(original_title,''))) like '%' || unaccent(lower(trim(p_q))) || '%'
        or unaccent(lower(coalesce(director,'')))       like '%' || unaccent(lower(trim(p_q))) || '%'
      )
      and (p_year is null or year = p_year)
    order by coalesce(is_analyzed, false) desc, year desc nulls last, slug
    limit 10
  ) t;
$$;

revoke execute on function public.films_basic_search(text, int) from public, anon, authenticated;
grant  execute on function public.films_basic_search(text, int) to service_role;
