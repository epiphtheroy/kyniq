-- 0116_mobile_fuzzy_search.sql
-- Very-fuzzy, 1-character-capable, accent-insensitive, MULTILINGUAL film search for the
-- mobile app (owner 07-29: "1~2 글자/알파벳만 쳐도 나와야, 외국어도 대응").
--
-- The existing search_all (0062) gates at length >= 2, has no unaccent, and doesn't
-- touch films.title_ko — so it can't serve 1-char or accented/Korean prefix queries.
-- This adds a dedicated, additive RPC (film_catalog_search) alongside it; search_all is
-- left untouched for the omni entity surface. Mobile wires api.searchFuzzy() to this.
--
-- ⚠️ Apply via the owner's apply-sql path (SB_UA header required). Idempotent.

-- unaccent is live in prod but never declared in a migration — guard it.
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- IMMUTABLE wrapper: the 1-arg public.unaccent(text) is only STABLE, so it can't be
-- indexed on directly; wrapping it and marking the wrapper IMMUTABLE is the standard,
-- safe pattern (the default unaccent dictionary is fixed). unaccent lives in `public`
-- on this project (verified) — mirror how films_basic_search (0094) calls it 1-arg.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$ select public.unaccent($1) $$;

-- Accent-folded trigram GIN indexes. GIN trgm also accelerates LIKE 'x%' (prefix) and
-- LIKE '%x%' (substring), so 1–2-char prefix/substring queries hit the index too.
create index if not exists idx_films_title_unacc_trgm
  on public.films using gin (public.f_unaccent(lower(title)) gin_trgm_ops);
create index if not exists idx_films_otitle_unacc_trgm
  on public.films using gin (public.f_unaccent(lower(coalesce(original_title, ''))) gin_trgm_ops);
create index if not exists idx_films_titleko_unacc_trgm
  on public.films using gin (public.f_unaccent(lower(coalesce(title_ko, ''))) gin_trgm_ops);

-- 1-char prefix + <=2-char substring + accent-folded across title / original_title /
-- title_ko, with trigram typo-tolerance kicking in at n >= 3.
create or replace function public.film_catalog_search(p_q text, p_limit int default 30)
returns table (
  slug text,
  title text,
  original_title text,
  title_ko text,
  year int,
  director text,
  poster_path text,
  is_catalog boolean,
  score real
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with q as (
    select public.f_unaccent(lower(btrim(p_q))) as qn,
           length(btrim(p_q)) as n
  )
  select
    f.slug, f.title, f.original_title, f.title_ko, f.year, f.director, f.poster_path,
    (not f.visible) as is_catalog,
    greatest(
      case when public.f_unaccent(lower(f.title)) like (select qn from q) || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_ko, ''))) like (select qn from q) || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.original_title, ''))) like (select qn from q) || '%' then 0.95 else 0 end,
      case when public.f_unaccent(lower(f.title)) like '%' || (select qn from q) || '%' then 0.6 else 0 end,
      case when (select n from q) >= 3 then similarity(public.f_unaccent(lower(f.title)), (select qn from q)) else 0 end,
      case when (select n from q) >= 3 then 0.9 * similarity(public.f_unaccent(lower(coalesce(f.original_title, ''))), (select qn from q)) else 0 end
    )::real as score
  from public.films f, q
  where (f.visible or f.slug not like 'tmdb-%')
    and q.n >= 1
    and (
         public.f_unaccent(lower(f.title))                        like '%' || q.qn || '%'
      or public.f_unaccent(lower(coalesce(f.original_title, '')))  like '%' || q.qn || '%'
      or public.f_unaccent(lower(coalesce(f.title_ko, '')))        like '%' || q.qn || '%'
      or (q.n >= 3 and (public.f_unaccent(lower(f.title)) % q.qn))
    )
  order by score desc, f.visible desc, f.year desc nulls last
  limit greatest(1, least(p_limit, 60));
$$;

grant execute on function public.film_catalog_search(text, int) to anon, authenticated, service_role;
