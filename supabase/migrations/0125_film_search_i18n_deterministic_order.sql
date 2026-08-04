-- 0125 — film_search_i18n: make the result order deterministic.
--
-- Body is 0124 verbatim (see that file for why the alias lookup is an
-- uncorrelated `= any(array(...))` and not an OR'd EXISTS). The ONLY change is
-- the last line: `, f.slug` appended to the ORDER BY.
--
-- Why. The sort was `score desc, f.visible desc, f.year desc nulls last`, which
-- is not a total order. For a short query the tie groups are enormous — q='a'
-- matches 4,861 films and 525 of them score exactly 1.0, because the top score
-- is a prefix match and "a" prefixes anything starting with the letter. Once
-- score, visibility and year are equal, nothing decides the order, so which rows
-- survive `limit 30` is whatever the scan happened to emit first.
--
-- That is latent until a plan changes, and then it looks like the corpus moved:
-- 0124 swapped a sequential scan for a bitmap heap scan and q='a' silently
-- returned a different 30 films. Both sets were correct — all 30 scored 1.0 —
-- but "same query, different films, no data change" is indistinguishable from a
-- bug to anyone reading it, and the Explore field in the app fires this on every
-- keystroke, so a 1-character query is the common case, not the edge case.
--
-- f.slug is the right tiebreaker: unique (films_slug_key), stable, and it only
-- ever decides rows that are already equal on every signal the function ranks by.
-- It does not reorder anything that scoring already separated — verified after
-- applying: every query whose results were not already at a tie boundary is
-- byte-identical, in the same order.

create or replace function public.film_search_i18n(p_q text, p_limit integer default 30, p_lang text default 'en')
returns table(slug text, title text, title_loc text, original_title text, year integer,
              director text, poster_path text, is_catalog boolean, score real)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with q as (
    select public.f_unaccent(lower(btrim(p_q))) as qn,
           length(btrim(p_q))                   as n,
           lower(coalesce(nullif(btrim(p_lang), ''), 'en')) as lang
  )
  select
    f.slug,
    f.title,
    coalesce(
      nullif(case q.lang
        when 'ko' then f.title_ko when 'es' then f.title_es when 'ja' then f.title_ja
        when 'zh' then f.title_zh when 'fr' then f.title_fr when 'hi' then f.title_hi
      end, ''),
      f.title
    ) as title_loc,
    f.original_title, f.year, f.director, f.poster_path,
    (not f.visible) as is_catalog,
    greatest(
      case when public.f_unaccent(lower(f.title)) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_ko,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_es,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_ja,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_zh,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_fr,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_hi,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.original_title,''))) like q.qn || '%' then 0.95 else 0 end,
      case when public.f_unaccent(lower(f.title)) like '%' || q.qn || '%' then 0.6 else 0 end,
      case when q.n >= 3 then similarity(public.f_unaccent(lower(f.title)), q.qn) else 0 end,
      case when q.n >= 3 then 0.9 * similarity(public.f_unaccent(lower(coalesce(f.original_title,''))), q.qn) else 0 end,
      -- Alias hit: just under a title hit, as in search_all. Correlated on
      -- purpose — by here the candidate set is already tiny.
      0.97 * coalesce((
        select max(
          case when public.f_unaccent(lower(a.alias)) like q.qn || '%' then 1.0
               when public.f_unaccent(lower(a.alias)) like '%' || q.qn || '%' then 0.75
               else 0 end)
        from public.search_aliases a
        where a.kind = 'film' and a.slug = f.slug
          and public.f_unaccent(lower(a.alias)) like '%' || q.qn || '%'
      ), 0)
    )::real as score
  from public.films f, q
  where (f.visible or f.slug not like 'tmdb-%')
    and q.n >= 1
    and (
         public.f_unaccent(lower(f.title))                       like '%' || q.qn || '%'
      or public.f_unaccent(lower(coalesce(f.original_title,''))) like '%' || q.qn || '%'
      or public.f_unaccent(lower(coalesce(f.title_ko,'')))       like '%' || q.qn || '%'
      or public.f_unaccent(lower(coalesce(f.title_es,'')))       like '%' || q.qn || '%'
      or public.f_unaccent(lower(coalesce(f.title_ja,'')))       like '%' || q.qn || '%'
      or public.f_unaccent(lower(coalesce(f.title_zh,'')))       like '%' || q.qn || '%'
      or public.f_unaccent(lower(coalesce(f.title_fr,'')))       like '%' || q.qn || '%'
      or public.f_unaccent(lower(coalesce(f.title_hi,'')))       like '%' || q.qn || '%'
      or (q.n >= 3 and (public.f_unaccent(lower(f.title)) % q.qn))
      or f.slug = any(array(
           select a.slug from public.search_aliases a, q q2
           where a.kind = 'film'
             and public.f_unaccent(lower(a.alias)) like '%' || q2.qn || '%'
         ))
    )
  -- f.slug closes the order (0125). Without it `limit` cuts an arbitrary slice
  -- of the tie group and the same query can answer differently run to run.
  order by score desc, f.visible desc, f.year desc nulls last, f.slug
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$;
