-- 0130 — close the ORDER BY on the last two ranked read-path RPCs.
--
-- APPLIED 2026-08-04.
--
-- Third instance of the bug 0125 and 0127 fixed: a ranking function with a LIMIT
-- whose ORDER BY is not a total order. Whichever rows survive the cut are then
-- decided by scan order, so the same query can answer differently whenever the
-- planner changes its mind — and this session changed several plans.
--
-- Swept every ranked RPC on a read path. Already correct, left alone:
--     trope_members_ranked   … , f.title asc, t.id asc
--     sentences_for_entity   … , fs.id
--     cinecodex_ranked       order by rank            (unique)
--     surprise_home          order by random()        (deliberate)
-- Not closed here: me_recommend_wwi (a personalisation score with no natural
-- key, low call volume — worth revisiting if it ever surfaces publicly).
--
--   search_essays      score, film_year  ->  + film_slug, desk_key
--                      (the pair is the dedup key of the GROUP BY above it)
--   theorist_readings  year, title       ->  + t.id
--
-- VERIFIED: results unchanged for 8 essay queries and the 6 theorists with the
-- most published readings (14/14 identical fingerprints).

create or replace function public.search_essays(p_q text, p_limit integer default 20)
returns table(kind text, slug text, film_slug text, title text, sub text, poster text, year integer, score real, is_catalog boolean)
language sql
stable
security definer
set search_path to 'public'
set statement_timeout to '5s'
as $function$
with q as (select btrim(p_q) as t, lower(btrim(p_q)) as tl)
select 'essay'::text as kind, x.desk_key as slug, x.film_slug, x.essay_title as title,
       trim(both ' ·' from x.film_title || coalesce(' · '||x.film_year::text,'')) as sub,
       f.poster_path as poster, x.film_year as year, x.score, false as is_catalog
from (
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
order by x.score desc, x.film_year desc nulls last, x.film_slug, x.desk_key
limit greatest(1, least(p_limit, 40));
$function$;

create or replace function public.theorist_readings(p_slug text, p_limit integer)
returns table(take_id uuid, take_title text, framework text, thesis text, leap text, concept text,
              fig_label text, fig_slug text, film_title text, film_slug text, film_year integer, backdrop_path text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select t.id, t.take_title, t.framework, t.rationale, t.leap,
         t.concept, f.label, f.slug,
         fl.title, fl.slug, fl.year, fl.backdrop_path
  from public.theorists th
  join public.takes t on t.theorist_id = th.id and t.status='published'
  join public.figures f on f.id = t.figure_id
  join public.films fl on fl.id = f.film_id
  where th.slug = p_slug
  order by fl.year desc nulls last, fl.title asc, t.id
  limit p_limit;
$function$;
