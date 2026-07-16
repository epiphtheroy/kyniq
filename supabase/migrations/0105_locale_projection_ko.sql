-- 0105 — locale projection, wave 1 (ko).
-- 정본: HANDOFF-KO프로젝션-한국어사이트.md §3.1
--
-- Additive nullable columns only (invariant P3). No NOT NULL, no default, no
-- index, no trigger, no view change, no RLS change: every existing EN query,
-- factory stage and worker keeps working untouched, and `select("*")` callers
-- simply start receiving the new columns.
--
-- The translation of a DB text value lives in a sibling `_<loc>` column on the
-- same row, read through lib/i18n/values.ts locVal() with an English fallback.
-- Longform prose (takes/essays/figures/reception bodies) is NOT projected this
-- way — that layer belongs to content_i18n (HANDOFF-한국어화-i18n-마스터.md §6).
-- Never store the same field in both.
--
-- Adding a language = copy this file, swap the suffix (§-2.2 step 4).

alter table films add column if not exists title_ko text;
alter table films add column if not exists overview_ko text;
alter table films add column if not exists ko_fetched_at timestamptz;

alter table film_locations add column if not exists name_ko text;

comment on column films.title_ko is
  'TMDB ko-KR official title. Never a hand/LLM translation. NULL => fall back to films.title. Written by worker/tmdb-i18n-backfill.py --locale ko.';
comment on column films.overview_ko is
  'TMDB ko-KR overview. NULL => fall back to films.overview (common: TMDB has no ko synopsis for many older films). Gates ko indexability (work order §6.2).';
comment on column films.ko_fetched_at is
  'Last TMDB ko-KR fetch for this row. Incremental cursor for the backfill worker; NULL => never fetched.';
comment on column film_locations.name_ko is
  'Korean place name. NULL => fall back to film_locations.name. Uncertain proper nouns stay English by rule (work order §3.3).';
