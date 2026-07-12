-- 0094_films_basic_search.sql — diacritic-insensitive film lookup for the MCP server (2026-07-13)
--
-- The MCP search_films tool matched with plain PostgREST ilike, so "kieslowski"
-- missed "Krzysztof Kieślowski" (9 films) — and AI assistants type ASCII. This
-- RPC does the same match through unaccent() on both sides (title, original
-- title, director), so ASCII queries hit accented rows and vice versa.
-- films is ~74k rows; the seq scan is milliseconds. service_role only — reached
-- through /api/mcp, which carries the anti-harvest guard and usage ledger.

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
    where (visible is distinct from false)
      and length(trim(coalesce(p_q, ''))) > 0
      and (
        unaccent(lower(title))                        like '%' || unaccent(lower(trim(p_q))) || '%'
        or unaccent(lower(coalesce(original_title,''))) like '%' || unaccent(lower(trim(p_q))) || '%'
        or unaccent(lower(coalesce(director,'')))       like '%' || unaccent(lower(trim(p_q))) || '%'
      )
      and (p_year is null or year = p_year)
    order by is_analyzed desc, year desc nulls last
    limit 10
  ) t;
$$;

revoke execute on function public.films_basic_search(text, int) from public, anon, authenticated;
grant  execute on function public.films_basic_search(text, int) to service_role;
