-- 0122 — teach film_search_i18n (0121) the alias index.
--
-- Gap found while answering the owner on 2026-08-03: 0121 made the app's film
-- search multilingual by TITLE COLUMNS (title_ko/es/ja/zh/fr/hi), but the repo
-- already had a second, older multilingual mechanism it did not consult —
-- `search_aliases` (0053), a SEARCH-ONLY name index with ~5,000 Korean film
-- aliases in it. So the fuzzy engine could find 화양연화 (a title column) but not
-- a film whose only Korean name lives in search_aliases, while search_all could
-- do the reverse but gates at length >= 2 and has no unaccent.
--
-- One engine should know both. Titles stay the primary signal; an alias hit
-- scores just under an exact title hit, mirroring how search_all weighs them
-- (0.97 of the direct match).
--
-- ⚠️ search_aliases is a SEARCH KEY TABLE. Nothing in it is ever displayed —
-- that is what lets it hold TMDB's also_known_as, whose entries are unverified
-- market transliterations (four different Korean spellings of Adam Elliot). The
-- rendered name always comes from films.title / films.title_<loc>.
--
-- Idempotent; CREATE OR REPLACE keeps the exact return type of 0121.

create or replace function public.film_search_i18n(
  p_q     text,
  p_limit int  default 30,
  p_lang  text default 'en'
)
returns table (
  slug           text,
  title          text,
  title_loc      text,
  original_title text,
  year           int,
  director       text,
  poster_path    text,
  is_catalog     boolean,
  score          real
)
language sql
stable
security definer
set search_path to 'public'
as $$
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
      -- Alias hit: just under a title hit, as in search_all.
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
      or exists (
           select 1 from public.search_aliases a
           where a.kind = 'film' and a.slug = f.slug
             and public.f_unaccent(lower(a.alias)) like '%' || q.qn || '%'
         )
    )
  order by score desc, f.visible desc, f.year desc nulls last
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

comment on function public.film_search_i18n(text, int, text) is
  'Multilingual film search for the app. MATCHES across title/original_title/title_<loc> in every projected language AND the search_aliases index (0122), so the query language never matters; RETURNS title_loc in the caller''s language with an English fallback. search_aliases is match-only — never rendered. Supersedes film_catalog_search (0116), which stays for older app builds.';

-- The alias predicate is `f_unaccent(lower(alias)) LIKE '%x%'`; the existing
-- idx_search_aliases_alias_trgm is on the RAW column, so it cannot serve it.
-- Index the folded expression the function actually asks for.
create index if not exists idx_search_aliases_alias_unacc_trgm
  on public.search_aliases using gin (public.f_unaccent(lower(alias)) gin_trgm_ops);
