-- 0054_search_essays_by_entity.sql — global search finds desk essays by the
-- theorist/concept they discuss (not just by title).
--
-- Problem (reported 2026-07-10): searching "Jean Baudrillard" anywhere on the site
-- (incl. the ⌘K palette on a /decoder page) returned only the theorist entity, never
-- the decoder essays that actually discuss Baudrillard. essay_entity_links already
-- maps every essay to its theorists/concepts (13,355 links, pre-filtered to
-- verified/en/visible), so a dedicated lexical RPC over it — fused into the existing
-- engine alongside search_all — makes those essays first-class search results.
--
-- Kept OUT of search_all deliberately: search_all is the hot path; a separate RPC
-- (like search_semantic) is merged in lib/search.ts, so this change can't regress
-- the 12 existing entity legs.

create extension if not exists pg_trgm;
create index if not exists idx_eel_essay_title_trgm on public.essay_entity_links using gin (essay_title gin_trgm_ops);
create index if not exists idx_eel_entity_name_trgm on public.essay_entity_links using gin (entity_name gin_trgm_ops);

drop function if exists public.search_essays(text, integer);
create function public.search_essays(p_q text, p_limit integer default 20)
returns table(kind text, slug text, film_slug text, title text, sub text, poster text, year integer, score real, is_catalog boolean)
language sql stable security definer
set search_path to 'public'
set statement_timeout to '5s'
as $$
with q as (select btrim(p_q) as t, lower(btrim(p_q)) as tl)
select 'essay'::text as kind, x.desk_key as slug, x.film_slug, x.essay_title as title,
       trim(both ' ·' from x.film_title || coalesce(' · '||x.film_year::text,'')) as sub,
       f.poster_path as poster, x.film_year as year, x.score, false as is_catalog
from (
  -- one row per essay (desk_key + film): best of title-match and discussed-entity-match
  select e.desk_key, e.film_slug, e.essay_title, e.film_title, e.film_year,
         max(greatest(
           (lower(e.essay_title) = (select tl from q))::int::real,
           case when lower(e.essay_title) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(e.essay_title, (select t from q)),
           word_similarity((select t from q), e.essay_title),
           0.9 * greatest(
             (lower(e.entity_name) = (select tl from q))::int::real,
             similarity(e.entity_name, (select t from q)),
             word_similarity((select t from q), e.entity_name))
         ))::real as score
  from essay_entity_links e
  where (select length(t) from q) >= 2
    and (e.essay_title % (select t from q) or e.essay_title ilike '%'||(select t from q)||'%'
         or e.entity_name % (select t from q) or e.entity_name ilike '%'||(select t from q)||'%')
  group by e.desk_key, e.film_slug, e.essay_title, e.film_title, e.film_year
) x
join films f on f.slug = x.film_slug and f.visible
where x.score > 0.2
order by x.score desc, x.film_year desc nulls last
limit greatest(1, least(p_limit, 40));
$$;

grant execute on function public.search_essays(text, integer) to anon, authenticated, service_role;
