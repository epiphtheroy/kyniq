-- 0057_tv_seed.sql
-- Seed: first 10 compiled programs + 3 playlists.
--  · palme-files     (films)    — Palme d'Or winners among the compiled ten
--  · thriller-files  (films)    — genre cut (Thriller ∈ films.genres)
--  · on-location     (segments) — the TOPIC SLICE: every film's `locations`
--    segment, cut across programs. This is the proof of the future
--    "action-film locations"-style compilation: a WHERE clause, not a rebuild.
-- (Programs are compiled by tv_compile_film(); see 0056. Idempotent.)

delete from tv_playlists where slug in ('palme-files','thriller-files','on-location');

-- 1 · Palme d'Or winners (films kind)
with pl as (
  insert into tv_playlists (slug, title, dek, kind, rule)
  values ('palme-files', 'The Palme d''Or Files',
          'Six winners of Cannes'' top prize — each reopened as a critical file.',
          'films', '{"list":"palme_dor","result":"won"}'::jsonb)
  returning id
)
insert into tv_playlist_items (playlist_id, pos, program_id)
select (select id from pl), row_number() over (order by f.year), p.id
from tv_programs p join films f on f.id = p.film_id
where f.slug in ('the-wages-of-fear-1953','the-conversation-1974','apocalypse-now-1979',
                 'pulp-fiction-1994','shoplifters-2018','anatomy-of-a-fall-2023');

-- 2 · Thriller night (genre cut, films kind)
with pl as (
  insert into tv_playlists (slug, title, dek, kind, rule)
  values ('thriller-files', 'Thriller Night',
          'The thrillers, reopened — misreadings, verdicts and the places they really happened.',
          'films', '{"genre":"Thriller"}'::jsonb)
  returning id
)
insert into tv_playlist_items (playlist_id, pos, program_id)
select (select id from pl), row_number() over (order by f.year), p.id
from tv_programs p join films f on f.id = p.film_id
where 'Thriller' = any(f.genres);

-- 3 · On location (TOPIC SLICE, segments kind)
with pl as (
  insert into tv_playlists (slug, title, dek, kind, rule)
  values ('on-location', 'On Location',
          'Only the places — every film''s shooting-map chapter, cut into one reel.',
          'segments', '{"topic":"locations"}'::jsonb)
  returning id
)
insert into tv_playlist_items (playlist_id, pos, segment_id)
select (select id from pl), row_number() over (order by f.title), s.id
from tv_segments s join films f on f.id = s.film_id
where s.topic = 'locations';
