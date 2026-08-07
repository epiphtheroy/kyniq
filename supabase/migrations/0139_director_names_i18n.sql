-- 0139 — the director's name in the reader's language.
--
-- Owner, 2026-08-07: the Tonight deck names every film's director in English
-- under a Korean title. 봉준호 is how he is written in Korean, and the prose we
-- already ship says so — the translator wrote it — while the card beside it says
-- "Bong Joon Ho".
--
-- SOURCE: Wikidata, reached by exact id, never by name.
--
--   directors.tmdb_person_id → TMDB /person/{id}/external_ids → wikidata_id
--                            → wbgetentities labels{ko,ja,zh,es,fr,hi}
--
-- Why not TMDB's own also_known_as: it is absent for exactly the people we most
-- need (Bong Joon Ho, Ozu, Kubrick all have no Korean there) and where present
-- it offers competing spellings with no way to choose — "잉마르 베리히만" beside
-- "잉그마르 베르히만". Wikidata gives one label, the standard one: 잉마르 베리만.
-- Measured over 60 directors: 98% carry a QID, 80% a Korean label.
--
-- Why by id and never by name: this repo has already been burned by name
-- matching — public.theorists was polluted to 22.5% by it. A QID join cannot
-- attach the wrong person.
--
-- Shape is 0105/0121/0137 repeated: additive nullable columns, no NOT NULL, no
-- default, no trigger, no view change, no RLS change. lib/i18n/values.ts locVal
-- reads them with no new code — locVal(director, "name", locale).
--
-- Idempotent. Apply via the owner's apply-sql path (SB_UA header required).

alter table directors add column if not exists name_ko text;
alter table directors add column if not exists name_es text;
alter table directors add column if not exists name_ja text;
alter table directors add column if not exists name_zh text;
alter table directors add column if not exists name_fr text;
alter table directors add column if not exists name_hi text;

-- Worth its own column beyond this feature: a stable public identifier for the
-- person, which is the identity anchor the agent-readiness work has been missing
-- (HANDOFF-AI봇맞이하기.md, gap ③). Fetched once, useful for far more than names.
alter table directors add column if not exists wikidata_id text;

-- ONE cursor for all six locales: wbgetentities returns every label in a single
-- response, the same reason films.images_fetched_at is one cursor and not six.
alter table directors add column if not exists names_fetched_at timestamptz;

comment on column directors.name_ko is
  'Wikidata ko label, joined by wikidata_id. NULL => fall back to directors.name. Never a hand or LLM transliteration, and never name-matched. Written by worker/director-names-i18n.py.';
comment on column directors.wikidata_id is
  'Wikidata QID via TMDB /person/{id}/external_ids. The person''s stable public identity; also the join key for the name_<loc> columns.';
comment on column directors.names_fetched_at is
  'Last Wikidata label fetch. ONE cursor for every locale — wbgetentities returns all labels in one response. NULL => never fetched.';

-- ── The app's list surfaces read all three facts in one call ─────────────────
--
-- Third widening of this function (0121 title → 0138 poster → 0139 director) and
-- the reasoning has not changed: a dozen list RPCs return English and only
-- English, and a card shows a film's title, its artwork and its director
-- together. Splitting them across calls would mean three round trips to paint
-- one row.
--
-- Signature unchanged (`returns json`), so this stays a plain create or replace:
-- no drop, no window where the function is missing, no frontend co-deploy.
-- Older clients read the keys they know and never see 'director'.
--
-- The row filter widens again — a film now qualifies on ANY localized fact — so
-- every field may be null and a caller must check the one it uses. The shipped
-- app guards `if (r?.slug && r?.title)`; the current one checks each field.
create or replace function public.film_titles_for_slugs(p_slugs text[], p_lang text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  with q as (select lower(coalesce(nullif(btrim(p_lang), ''), 'en')) as lang)
  select coalesce(
           json_agg(json_build_object(
             'slug', t.slug, 'title', t.loc, 'poster', t.poster, 'director', t.dir)),
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
           end, '') as poster,
           nullif(case q.lang
             when 'ko' then d.name_ko when 'es' then d.name_es when 'ja' then d.name_ja
             when 'zh' then d.name_zh when 'fr' then d.name_fr when 'hi' then d.name_hi
           end, '') as dir
    from public.films f
    cross join q
    -- LEFT: a film whose director we do not hold still deserves its title and
    -- poster. An inner join here would silently drop those rows.
    left join public.directors d on d.slug = f.director_slug
    where f.slug = any(p_slugs)
  ) t
  where t.loc is not null or t.poster is not null or t.dir is not null;
$$;

comment on function public.film_titles_for_slugs(text[], text) is
  'Bulk localized title + poster + director decoration for a set of slugs (mirrors takescore_for_slugs). Returns films carrying ANY localized fact in p_lang, so every field may be null and callers must check the one they use. English and uncovered languages cost one cheap empty round trip. Columns: titles 0105/0121, posters 0137, director names 0139.';

grant execute on function public.film_titles_for_slugs(text[], text) to anon, authenticated;
