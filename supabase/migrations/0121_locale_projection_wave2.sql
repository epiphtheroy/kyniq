-- 0121 — locale projection wave 2 (es · ja · zh · fr · hi) + multilingual film search.
--
-- Owner directive 2026-08-03: the app gets a CONTENT language axis that is
-- INDEPENDENT of the availability country. Picking a language must
--   (a) show each film's own release title in that language, and
--   (b) let you FIND a film by that title from anywhere — typing 화양연화 finds
--       In the Mood for Love even while the app itself is in English.
-- The UI chrome stays English on purpose (owner: the service targets viewers in
-- English-speaking markets; they do not need the whole app in their language —
-- they need to recognise the film).
--
-- Shape is 0105 (ko) repeated, per that file's own instruction ("adding a
-- language = copy this file, swap the suffix"): additive nullable `_<loc>`
-- columns — no NOT NULL, no default, no trigger, no view change, no RLS change.
-- Every existing English query, factory stage and worker keeps working untouched,
-- and `select("*")` callers simply start receiving the new columns.
--
-- The titles are TMDB's OWN official release titles. This is a data join, never
-- a translation: no translator should be inventing "화양연화" for In the Mood for
-- Love. Filled by `worker/tmdb-i18n-backfill.py --locale <loc> --persist`.
--
-- Idempotent. Apply via the owner's apply-sql path (SB_UA header required).

-- ── Columns ───────────────────────────────────────────────────────────────────
-- es (Spanish) · ja (Japanese) · zh (Chinese) · fr (French) · hi (Hindi).
-- ko already exists (0105) and is untouched — the web ko projection reads it.

alter table films add column if not exists title_es    text;
alter table films add column if not exists overview_es text;
alter table films add column if not exists es_fetched_at timestamptz;

alter table films add column if not exists title_ja    text;
alter table films add column if not exists overview_ja text;
alter table films add column if not exists ja_fetched_at timestamptz;

alter table films add column if not exists title_zh    text;
alter table films add column if not exists overview_zh text;
alter table films add column if not exists zh_fetched_at timestamptz;

alter table films add column if not exists title_fr    text;
alter table films add column if not exists overview_fr text;
alter table films add column if not exists fr_fetched_at timestamptz;

alter table films add column if not exists title_hi    text;
alter table films add column if not exists overview_hi text;
alter table films add column if not exists hi_fetched_at timestamptz;

comment on column films.title_es is
  'TMDB es-ES official title. Never a hand/LLM translation. NULL => fall back to films.title. Written by worker/tmdb-i18n-backfill.py --locale es.';
comment on column films.title_ja is
  'TMDB ja-JP official title. NULL => fall back to films.title. Written by worker/tmdb-i18n-backfill.py --locale ja.';
comment on column films.title_zh is
  'TMDB zh-CN official title (Simplified preferred; the worker falls back to any zh translation, which may be Traditional for HK/TW titles). NULL => fall back to films.title.';
comment on column films.title_fr is
  'TMDB fr-FR official title. NULL => fall back to films.title. Written by worker/tmdb-i18n-backfill.py --locale fr.';
comment on column films.title_hi is
  'TMDB hi-IN official title. Coverage is thin outside Indian cinema — NULL is the common case and falls back to films.title.';

-- ── Search indexes ────────────────────────────────────────────────────────────
-- Accent-folded trigram GIN, same pattern as 0116 (which indexed title,
-- original_title and title_ko). GIN trgm also accelerates LIKE 'x%' and '%x%',
-- so 1–2-char prefix queries hit the index in every language too.
-- f_unaccent() is the IMMUTABLE wrapper created in 0116.

create index if not exists idx_films_titlees_unacc_trgm
  on public.films using gin (public.f_unaccent(lower(coalesce(title_es, ''))) gin_trgm_ops);
create index if not exists idx_films_titleja_unacc_trgm
  on public.films using gin (public.f_unaccent(lower(coalesce(title_ja, ''))) gin_trgm_ops);
create index if not exists idx_films_titlezh_unacc_trgm
  on public.films using gin (public.f_unaccent(lower(coalesce(title_zh, ''))) gin_trgm_ops);
create index if not exists idx_films_titlefr_unacc_trgm
  on public.films using gin (public.f_unaccent(lower(coalesce(title_fr, ''))) gin_trgm_ops);
create index if not exists idx_films_titlehi_unacc_trgm
  on public.films using gin (public.f_unaccent(lower(coalesce(title_hi, ''))) gin_trgm_ops);

-- ── Multilingual search ───────────────────────────────────────────────────────
-- A NEW NAME, not an overload of film_catalog_search(p_q, p_limit): PostgREST
-- resolves overloads by the argument set it is handed, and a same-name 3-arg
-- sibling is exactly the ambiguity trap this repo has been bitten by before.
-- film_catalog_search stays untouched so app builds already in the wild keep
-- working; this is what the new client calls.
--
-- Two jobs in one function:
--   MATCH  — always across every language, so the query language is irrelevant.
--   DISPLAY — `title_loc` resolves to the caller's language, English fallback.

create or replace function public.film_search_i18n(
  p_q     text,
  p_limit int  default 30,
  p_lang  text default 'en'
)
returns table (
  slug           text,
  title          text,           -- English, always (the ledger's key)
  title_loc      text,           -- p_lang title, English fallback — what to render
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
      -- An exact-ish prefix hit in ANY language outranks everything.
      case when public.f_unaccent(lower(f.title)) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_ko,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_es,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_ja,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_zh,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_fr,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.title_hi,''))) like q.qn || '%' then 1.0 else 0 end,
      case when public.f_unaccent(lower(coalesce(f.original_title,''))) like q.qn || '%' then 0.95 else 0 end,
      case when public.f_unaccent(lower(f.title)) like '%' || q.qn || '%' then 0.6 else 0 end,
      -- Typo tolerance only once there are enough characters to be a real word.
      case when q.n >= 3 then similarity(public.f_unaccent(lower(f.title)), q.qn) else 0 end,
      case when q.n >= 3 then 0.9 * similarity(public.f_unaccent(lower(coalesce(f.original_title,''))), q.qn) else 0 end
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
    )
  order by score desc, f.visible desc, f.year desc nulls last
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

comment on function public.film_search_i18n(text, int, text) is
  'Multilingual film search for the app. MATCHES across title/original_title/title_<loc> in every projected language so the query language never matters; RETURNS title_loc in the caller''s language with an English fallback. Supersedes film_catalog_search (0116), which stays for older app builds.';

grant execute on function public.film_search_i18n(text, int, text) to anon, authenticated;

-- ── Bulk title projection ─────────────────────────────────────────────────────
-- Every list surface (You grid, Tonight deck, watchlist, navigator) gets its rows
-- from an RPC that returns only the English title. Rather than teach a dozen RPCs
-- about language, the client batches the slugs it is about to render through this
-- one call and overlays the result — the same shape as takescore_for_slugs, which
-- is this repo's bulk-decoration door.
--
-- Returns ONLY rows that actually have a localized title, so an English caller
-- (or a language with no coverage for those films) gets `[]` and renders the
-- English titles it already has. Never a per-film loop.

create or replace function public.film_titles_for_slugs(p_slugs text[], p_lang text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  with q as (select lower(coalesce(nullif(btrim(p_lang), ''), 'en')) as lang)
  select coalesce(json_agg(json_build_object('slug', t.slug, 'title', t.loc)), '[]'::json)
  from (
    select f.slug,
           nullif(case q.lang
             when 'ko' then f.title_ko when 'es' then f.title_es when 'ja' then f.title_ja
             when 'zh' then f.title_zh when 'fr' then f.title_fr when 'hi' then f.title_hi
           end, '') as loc
    from public.films f, q
    where f.slug = any(p_slugs)
  ) t
  where t.loc is not null and t.loc is distinct from '';
$$;

comment on function public.film_titles_for_slugs(text[], text) is
  'Bulk localized-title decoration for a set of slugs (mirrors takescore_for_slugs). Returns only films that HAVE a title in p_lang, so English and uncovered languages cost one cheap empty round trip and the caller keeps its English titles.';

grant execute on function public.film_titles_for_slugs(text[], text) to anon, authenticated;
