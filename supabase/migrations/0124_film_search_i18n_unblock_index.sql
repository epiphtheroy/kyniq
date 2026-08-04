-- 0124 — film_search_i18n: stop one OR'd EXISTS from forcing a full table scan.
--
-- APPLIED 2026-08-04 (supabase_migrations: film_search_i18n_unblock_index).
-- Verified after: 655 ms -> 31.5 ms for q='wong', ~6 ms warm; and result
-- fingerprints (slug + score, md5'd) are byte-identical before/after for
-- wong / kurosawa / 기생충 / 화양연화 / parasite / le samourai / blade runner /
-- hong / 2001. See the note at the bottom of this file about q='a'.
--
-- This is the RPC the mobile Explore field calls on every settled keystroke, so
-- it sits directly on the app's perceived search latency. Measured in production
-- (pg_stat_statements, 20.5h window ending 2026-08-04) it averaged 1,815 ms.
--
-- Cause. The WHERE ends in a correlated subquery OR'd against eight indexed
-- predicates:
--
--   or exists (select 1 from search_aliases a
--              where a.kind='film' and a.slug = f.slug
--                and f_unaccent(lower(a.alias)) like '%'||q.qn||'%')
--
-- Postgres de-correlates that into a hashed SubPlan, but a hashed SubPlan cannot
-- drive a bitmap index scan, and a BitmapOr is all-or-nothing: one un-indexable
-- branch and the whole disjunction falls back to a sequential scan. So all eight
-- idx_films_title*_unacc_trgm indexes went unused and every call scanned 7,158
-- films, evaluating eight f_unaccent(lower(…)) calls per row.
--
--   EXPLAIN ANALYZE, q='wong', warm cache:
--     with the OR'd EXISTS     Seq Scan on films, 7,156 rows filtered   333 ms
--     with the ARRAY form      BitmapOr over all 9 indexes + films_slug  35 ms
--
-- Fix. Hoist the alias lookup into an uncorrelated `= any(array(...))`. An ARRAY
-- from an InitPlan IS a valid bitmap index condition, so films_slug_key joins the
-- BitmapOr as a tenth branch and the sequential scan disappears.
--
-- Semantics are unchanged: `f.slug = any(array(select a.slug …))` selects exactly
-- the rows `exists (… and a.slug = f.slug …)` selected. Scoring, ordering, the
-- limit clamp and the correlated alias-score subquery are all byte-identical to
-- 0122 — that subquery now runs only for rows that survived the WHERE, which is
-- why it is left alone.

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
      -- WAS: or exists (select 1 from search_aliases a where … a.slug = f.slug …).
      -- The array form is the whole point of this migration — see the header.
      or f.slug = any(array(
           select a.slug from public.search_aliases a, q q2
           where a.kind = 'film'
             and public.f_unaccent(lower(a.alias)) like '%' || q2.qn || '%'
         ))
    )
  order by score desc, f.visible desc, f.year desc nulls last
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$;

-- Grants are not re-issued: create or replace preserves the existing ACL, and
-- 0122 already granted execute to anon/authenticated (the app calls it directly
-- with the anon key).

-- ⚠️ PRE-EXISTING LATENT ISSUE surfaced by this change, NOT caused by it.
-- q='a' returns a different 30 films than it did before. Both sets are correct:
-- 4,861 films match 'a', 525 of them score exactly 1.0 (title starts with "a"),
-- and the ORDER BY (score desc, visible desc, year desc nulls last) has no
-- unique tiebreaker — so which 30 of the 525 tied rows survive `limit 30` is
-- decided by scan order, which this migration changed. Every other query tested
-- is byte-identical, the new plan's 30 rows are all score 1.0, and repeated
-- calls are stable.
--
-- The real fix is a deterministic final tiebreaker:
--     order by score desc, f.visible desc, f.year desc nulls last, f.slug
-- Not applied here because it is a separate behaviour change and this migration
-- was scoped to the index fix. Worth doing — without it the same query can
-- return different films whenever the planner flips.
