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
