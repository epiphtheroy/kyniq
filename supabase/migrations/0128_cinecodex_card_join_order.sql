-- 0128 — cinecodex_card: stop looking up 90,701 films to return 39 of them.
--
-- APPLIED 2026-08-04 (supabase_migrations: cinecodex_card_join_order).
--
-- Measured before: 2,453 calls at 1,295 ms average = 11.6% of database time, and
-- 535,588 shared buffers PER CALL — roughly 4.2 GB of buffer traffic to draw one
-- film card, on a box with 512 MB of shared_buffers. The single largest source
-- of cache pressure in the database. Migration 0118 had already handed it
-- work_mem=64MB for the same symptom; this is the cause.
--
-- The `comps` CTE (nearest-scoring films on each of 13 axes) was 696 ms and
-- 486,378 of those buffers. It fanned `best` (6,978 films) over 13 axes into
-- 90,714 rows, then joined films AND film_scores to every one of them before the
-- window reduced the result to 3 per axis — 39 rows. The planner compounded it
-- by underestimating the CTE (454 vs 90,701), which made both joins nested loops:
--     films_pkey        90,701 loops -> 226,981 buffers
--     film_scores_pkey  90,701 loops -> 259,090 buffers
--
-- Two structural changes, no change in output:
--   1. prestige_score is a per-FILM value, so it is hash-joined once in `best`
--      (6,978 rows) and carried through `long`, instead of being looked up per
--      (film, axis) pair. `ranked` reads it from `best` too, dropping its own
--      film_scores join.
--   2. `comps` computes the window and applies rn <= 3 FIRST, then joins films
--      for the 39 survivors.
--
--     comps CTE:      696 ms / 486,378 buffers -> 384 ms /   802 buffers
--     whole function: 849 ms / 535,588 buffers -> 388 ms / 4,517 buffers
--
-- VERIFIED: md5 of the full card JSON unchanged for a 25-film sample (25/25).
--
-- STILL O(corpus) IN CPU. The window sorts 90,701 rows every call because rank
-- and comps are genuinely corpus-wide quantities. Making them incremental needs
-- a materialised view plus a refresh contract with the scoring factory — a
-- separate piece of work, and the remaining ~388 ms is where it would pay off.

create or replace function public.cinecodex_card(p_slug text)
returns json
language sql
stable
security definer
set search_path to 'public', 'cinecodex'
set work_mem to '64MB'
as $function$
  with tgt as (
    select f.id, f.slug, f.title, f.year, f.director, f.poster_path
    from public.films f where f.slug = p_slug
  ),
  best as (
    select distinct on (s.film_id) s.film_id,
      s.cog,s.aff,s.form,s.moral,s.dur,
      s.itx,s.fr,s.etx,s.ctx,s.bank,s.insincere,s.coward,s.polar,
      s.v_value,s.c_cost,s.r_risk,s.n_samples,s.sd_v,s.sd_r,s.panel,s.prompt_version,s.flagged,s.scored_at,
      fs.prestige_score
    from cinecodex.scores s
    left join public.film_scores fs on fs.film_id = s.film_id
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  b as (select * from best where film_id = (select id from tgt)),
  long as (
    select bb.film_id, bb.prestige_score, v.code, v.val
    from best bb, lateral (values
      ('cog',bb.cog),('aff',bb.aff),('form',bb.form),('moral',bb.moral),('dur',bb.dur),
      ('itx',bb.itx),('fr',bb.fr),('etx',bb.etx),('ctx',bb.ctx),
      ('bank',bb.bank),('insincere',bb.insincere),('coward',bb.coward),('polar',bb.polar)
    ) v(code,val)
  ),
  tv as (select code, val from long where film_id = (select id from tgt)),
  comps as (
    select q.code, json_agg(json_build_object('title', q.title, 'slug', q.slug, 'poster_path', q.poster_path) order by q.rn) films
    from (
      select c.code, f.title, f.slug, f.poster_path, c.rn
      from (
        select l.code, l.film_id,
               row_number() over (partition by l.code order by abs(l.val - t.val), l.prestige_score desc nulls last) rn
        from long l join tv t on t.code = l.code
        where l.film_id <> (select id from tgt)
      ) c
      join public.films f on f.id = c.film_id
      where c.rn <= 3
    ) q group by q.code
  ),
  ranked as (
    select f.id, f.slug, f.title, f.year, f.poster_path,
           round(bx.v_value - bx.r_risk) u, round(bx.r_risk) r,
           row_number() over (order by (bx.v_value - bx.r_risk) desc, bx.prestige_score desc nulls last, f.slug) rn
    from public.films f join best bx on bx.film_id = f.id
  ),
  selfrank as (select rn from ranked where id = (select id from tgt)),
  win as (
    select * from ranked
    where rn between greatest(1, least((select rn from selfrank) - 10, (select max(rn) from ranked) - 19))
                 and greatest(20, least((select rn from selfrank) + 9, (select max(rn) from ranked)))
    order by rn limit 20
  ),
  basket as (
    select json_agg(json_build_object(
      'title', w.title, 'slug', w.slug, 'year', w.year, 'poster_path', w.poster_path,
      'rank', w.rn, 'u', w.u, 'r', w.r, 'self', w.id = (select id from tgt)) order by w.rn) rows,
      (select max(rn) from ranked) total
    from win w
  ),
  lineage as (
    select array_agg(distinct fl.facet) filter (where fl.facet in ('award','festival','canon','national')) labels
    from public.film_lineage fl where fl.film_id = (select id from tgt)
  )
  select json_build_object(
    'slug', t.slug, 'title', t.title, 'year', t.year, 'director', t.director, 'poster_path', t.poster_path,
    'v', round(b.v_value,1), 'c', round(b.c_cost,1), 'r', round(b.r_risk,1),
    'u', round(b.v_value - b.r_risk), 's', round((b.v_value-50)/greatest(b.r_risk,1),2),
    'rank', (select rn from selfrank), 'rank_total', (select total from basket),
    'subs', json_build_object(
      'cog',b.cog,'aff',b.aff,'form',b.form,'moral',b.moral,'dur',b.dur,
      'itx',b.itx,'fr',b.fr,'etx',b.etx,'ctx',b.ctx,
      'bank',b.bank,'insincere',b.insincere,'coward',b.coward,'polar',b.polar),
    'comps', (select json_object_agg(code, films) from comps),
    'reliability', json_build_object('n_samples',b.n_samples,'sd_v',b.sd_v,'sd_r',b.sd_r,
      'panel',b.panel,'prompt_version',b.prompt_version,'flagged',b.flagged,'scored_at',b.scored_at),
    'conf', (select conf from public.cinecodex_confidence cc where cc.film_id=t.id),
    'tier', (select tier from public.cinecodex_confidence cc where cc.film_id=t.id),
    'n_takes', (select n_takes from public.cinecodex_confidence cc where cc.film_id=t.id),
    'ext', (select json_build_object('imdb',r.imdb_rating,'rt',r.rt_tomatometer,'meta',r.metascore)
            from public.film_ratings r where r.film_id=t.id),
    'standing', json_build_object(
       'prestige', (select round(prestige_score) from public.film_scores fs where fs.film_id=t.id),
       'labels', (select labels from lineage)),
    'basket', (select rows from basket)
  )
  from tgt t, b;
$function$;
