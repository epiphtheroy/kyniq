-- Metatake · 0137 + 0138 (2026-08-07)
-- 포스터 현지화: films.poster_path_<loc> × 6 + images_fetched_at, 그리고
-- film_titles_for_slugs가 poster 키를 함께 반환하도록 확장.
-- 가산적·멱등. 기존 컬럼·함수 시그니처 변경 없음.

-- 0137 — the poster in the reader's language.
--
-- Owner, 2026-08-07: a Korean app showing the US one-sheet is wrong. TMDB keys
-- every poster with an iso_639_1, and for a film like Parasite it holds 34
-- Korean ones alongside 85 English. Where a localized poster exists we should be
-- showing it; where it does not, English is the right answer, not a blank.
--
-- Shape is 0105/0121 repeated, per 0105's own instruction ("adding a language =
-- copy this file, swap the suffix"): additive nullable `_<loc>` columns. No NOT
-- NULL, no default, no index, no trigger, no view change, no RLS change. Every
-- existing English query, factory stage and worker keeps working untouched, and
-- `select("*")` callers simply start receiving the new columns.
--
-- The payoff of matching that shape exactly: lib/i18n/values.ts `locVal` already
-- reads it. `locVal(film, "poster_path", locale)` needs no new code — the same
-- three lines that resolve title_ko resolve poster_path_ko.
--
-- These are TMDB's own localized artwork, never a derivative we made.
--
-- Idempotent. Apply via the owner's apply-sql path (SB_UA header required).

-- ── Columns ───────────────────────────────────────────────────────────────────
alter table films add column if not exists poster_path_ko text;
alter table films add column if not exists poster_path_es text;
alter table films add column if not exists poster_path_ja text;
alter table films add column if not exists poster_path_zh text;
alter table films add column if not exists poster_path_fr text;
alter table films add column if not exists poster_path_hi text;

-- ONE cursor for all six, unlike the title backfill's per-locale `<loc>_fetched_at`.
--
-- That difference is the point: /movie/{id}/images returns EVERY language in a
-- single response, so one call fills all six columns at once. Six per-locale
-- cursors would invite six passes over the same 7,158 films for data we already
-- had in hand the first time — and an unthrottled backfill over this table is
-- exactly what saturated the database once before.
--
-- Deliberately NOT reusing `<loc>_fetched_at`: that column is the TITLE
-- backfill's cursor, and stamping it here would tell that worker a film had been
-- processed when its title had not. (The ko title run died mid-alphabet on
-- 07-17 and 2,283 films sat unfetched until 08-07 — a poisoned cursor would have
-- hidden that gap instead of leaving it visible.)
alter table films add column if not exists images_fetched_at timestamptz;

comment on column films.poster_path_ko is
  'TMDB poster whose iso_639_1 is ko, best-voted. NULL => fall back to films.poster_path (common: most pre-1990 and non-Korean-released films have no ko artwork). Written by worker/tmdb-poster-i18n.py.';
comment on column films.poster_path_es is 'TMDB es poster. NULL => fall back to films.poster_path.';
comment on column films.poster_path_ja is 'TMDB ja poster. NULL => fall back to films.poster_path.';
comment on column films.poster_path_zh is 'TMDB zh poster. NULL => fall back to films.poster_path.';
comment on column films.poster_path_fr is 'TMDB fr poster. NULL => fall back to films.poster_path.';
comment on column films.poster_path_hi is 'TMDB hi poster. NULL => fall back to films.poster_path.';
comment on column films.images_fetched_at is
  'Last /movie/{id}/images fetch. ONE cursor for every locale — that endpoint returns all languages in one response. NULL => never fetched. Never reuse the title backfill''s <loc>_fetched_at for this.';


-- 0138 — the bulk title decorator also carries the poster.
--
-- Owner, 2026-08-07: the Korean app should show the Korean poster. Migration
-- 0137 put the artwork in poster_path_<loc>; this is how the app's LIST surfaces
-- reach it.
--
-- Why extend this function rather than add another: every list RPC in the app
-- (me_collection, tonight, navigator, search_all) returns English and only
-- English, and 0121's answer was one batched decorator at the edge instead of a
-- dozen migrations. A poster is the same kind of fact as a title — the film's
-- own presentation in a language — so it belongs on the same axis and in the
-- same round trip. A second RPC would double the requests to say one more word.
--
-- Backward compatible by construction, on both halves:
--
--   · The signature is unchanged: `returns json`. So this is a plain
--     `create or replace` — no drop, no window where the function does not
--     exist, no frontend/RPC co-deploy dance. Older clients read 'slug' and
--     'title' and never look at 'poster'.
--
--   · The row filter widens from "has a localized title" to "has a localized
--     title OR a localized poster", so a film with Korean artwork but no Korean
--     title now comes back with title = null. The shipped app guards
--     `if (r?.slug && r?.title)` before storing, so those rows are ignored
--     rather than blanking a title. Verified in mobile/src/lib/api.ts before
--     widening — a nullable field is only safe if the reader already checks.
--
-- Idempotent. Apply via the owner's apply-sql path (SB_UA header required).
-- Requires 0137 (the poster_path_<loc> columns).

create or replace function public.film_titles_for_slugs(p_slugs text[], p_lang text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  with q as (select lower(coalesce(nullif(btrim(p_lang), ''), 'en')) as lang)
  select coalesce(
           json_agg(json_build_object('slug', t.slug, 'title', t.loc, 'poster', t.poster)),
           '[]'::json)
  from (
    select f.slug,
           nullif(case q.lang
             when 'ko' then f.title_ko when 'es' then f.title_es when 'ja' then f.title_ja
             when 'zh' then f.title_zh when 'fr' then f.title_fr when 'hi' then f.title_hi
           end, '') as loc,
           nullif(case q.lang
             when 'ko' then f.poster_path_ko when 'es' then f.poster_path_es
             when 'ja' then f.poster_path_ja when 'zh' then f.poster_path_zh
             when 'fr' then f.poster_path_fr when 'hi' then f.poster_path_hi
           end, '') as poster
    from public.films f, q
    where f.slug = any(p_slugs)
  ) t
  -- Either fact is worth the row. English callers still never get here: the
  -- caller short-circuits on lang='en', and for a language with no coverage this
  -- returns '[]' — one cheap empty round trip, English stands.
  where t.loc is not null or t.poster is not null;
$$;

comment on function public.film_titles_for_slugs(text[], text) is
  'Bulk localized title + poster decoration for a set of slugs (mirrors takescore_for_slugs). Returns films that have EITHER a localized title or localized artwork in p_lang, so either field may be null and callers must check the one they use. English and uncovered languages cost one cheap empty round trip and the caller keeps its English values. Poster columns are migration 0137.';

grant execute on function public.film_titles_for_slugs(text[], text) to anon, authenticated;
