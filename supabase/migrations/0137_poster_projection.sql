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
