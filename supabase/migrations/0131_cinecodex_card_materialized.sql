-- 0131 — cinecodex_card stops rebuilding the whole corpus on every film view.
--
-- APPLIED 2026-08-04.
--
-- WHAT THIS FUNCTION IS. cinecodex_card(slug) returns the TakeScore card for one
-- film: V/C/R/U/S, the 13 sub-scores, the film's rank out of the scored corpus,
-- a 20-film "basket" of its neighbours in that ranking, the 3 nearest films on
-- each of the 13 axes ("comps"), reliability metadata, external ratings and
-- standing. It backs /takescore/film/[slug], the mobile film detail
-- (/api/v1/app/film/[slug]), /room/film/[slug], the screener panel and the
-- TakeScore OG image. It is a real product surface, not incidental.
--
-- WHY IT WAS SLOW. rank, basket and comps are corpus-wide quantities, and the
-- function computed all of them from scratch per request: fan 6,978 scored films
-- across 13 axes into 90,714 rows, window-sort that set, and rank every film —
-- to render one card. 0128 fixed the join order (535,588 buffers -> 4,517) but
-- the O(corpus) sort remained at ~388 ms.
--
-- WHY MATERIALISING IS SAFE HERE. cinecodex.scores holds exactly one batch:
-- 6,978 rows, all scored_at 2026-07-15, a single distinct date. These are not
-- live quantities — they change only when the factory's S40-takescore stage
-- runs. Recomputing them on every page view was the whole problem.
--
--   cinecodex_axis  90,714 rows / 12 MB   (film_id, code, val, prestige_score)
--   cinecodex_rank   6,978 rows / 1.4 MB  (film_id, slug, title, year, poster, u, r, rn)
--
-- comps now runs as two index range scans per axis against
-- (code, val, prestige_score desc) instead of sorting 90,701 rows: walk outward
-- from the target's value on each side, take 16, and order the 32 candidates by
-- the original key. That is exact, not approximate — the index order IS the
-- ranking order, so the true top 3 are always at the front of one side.
--
--     826 ms average -> 18.1 ms (min 11.7, max 26.3)
--     production mean before any of this work: 1,295 ms
--
-- VERIFIED against the exhaustive computation over 30 films:
--   comps  390/390 axis comparisons set-identical
--   rank   30/30 match a live recomputation of the original ranking expression
--   total  30/30 · basket 30/30 have their 20 entries · 3 repeat calls identical
--
-- The comps ORDER BY gains c2.film_id as a final key. Without it the third pick
-- came from an exact tie in (|val difference|, prestige) and was decided by scan
-- order — the same latent bug as 0125/0127/0130, and changing the plan here
-- exposed it (11 of 30 cards differed by a permutation of the same films).
--
-- ⚠️ REFRESH CONTRACT. The views are stale until refreshed, so a newly scored
-- film would have no rank and no comps. score/cinecodex_score.py now calls
-- cinecodex_refresh() immediately after cinecodex_aggregate. Anything else that
-- writes cinecodex.scores or film_scores.prestige_score must do the same.

create materialized view if not exists public.cinecodex_axis as
select bb.film_id, v.code, v.val, bb.prestige_score
from (
  select distinct on (s.film_id) s.film_id,
    s.cog,s.aff,s.form,s.moral,s.dur,s.itx,s.fr,s.etx,s.ctx,s.bank,s.insincere,s.coward,s.polar,
    fs.prestige_score
  from cinecodex.scores s
  left join public.film_scores fs on fs.film_id = s.film_id
  order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
) bb, lateral (values
  ('cog',bb.cog),('aff',bb.aff),('form',bb.form),('moral',bb.moral),('dur',bb.dur),
  ('itx',bb.itx),('fr',bb.fr),('etx',bb.etx),('ctx',bb.ctx),
  ('bank',bb.bank),('insincere',bb.insincere),('coward',bb.coward),('polar',bb.polar)
) v(code,val);

create unique index if not exists cinecodex_axis_pk on public.cinecodex_axis (code, film_id);
create index if not exists cinecodex_axis_code_val on public.cinecodex_axis (code, val, prestige_score desc nulls last);

create materialized view if not exists public.cinecodex_rank as
select f.id as film_id, f.slug, f.title, f.year, f.poster_path,
       round(bx.v_value - bx.r_risk) as u, round(bx.r_risk) as r,
       row_number() over (order by (bx.v_value - bx.r_risk) desc, bx.prestige_score desc nulls last, f.slug) as rn
from public.films f
join (
  select distinct on (s.film_id) s.film_id, s.v_value, s.r_risk, fs.prestige_score
  from cinecodex.scores s
  left join public.film_scores fs on fs.film_id = s.film_id
  order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
) bx on bx.film_id = f.id;

create unique index if not exists cinecodex_rank_pk on public.cinecodex_rank (film_id);
create unique index if not exists cinecodex_rank_rn on public.cinecodex_rank (rn);

grant select on public.cinecodex_axis, public.cinecodex_rank to anon, authenticated, service_role;

create or replace function public.cinecodex_card(p_slug text)
returns json
language sql
stable
security definer
set search_path to 'public', 'cinecodex'
as $function$
  with tgt as (
    select f.id, f.slug, f.title, f.year, f.director, f.poster_path
    from public.films f where f.slug = p_slug
  ),
  b as (
    select distinct on (s.film_id) s.film_id,
      s.cog,s.aff,s.form,s.moral,s.dur,s.itx,s.fr,s.etx,s.ctx,s.bank,s.insincere,s.coward,s.polar,
      s.v_value,s.c_cost,s.r_risk,s.n_samples,s.sd_v,s.sd_r,s.panel,s.prompt_version,s.flagged,s.scored_at
    from cinecodex.scores s
    where s.film_id = (select id from tgt)
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  tv as (select a.code, a.val from public.cinecodex_axis a where a.film_id = (select id from tgt)),
  comps as (
    select tv.code, (
      select json_agg(json_build_object('title', f.title, 'slug', f.slug, 'poster_path', f.poster_path) order by c.ord)
      from (
        select c2.film_id,
               row_number() over (order by abs(c2.val - tv.val), c2.prestige_score desc nulls last, c2.film_id) ord
        from (
          (select x.film_id, x.val, x.prestige_score from public.cinecodex_axis x
            where x.code = tv.code and x.val <= tv.val and x.film_id <> (select id from tgt)
            order by x.val desc, x.prestige_score desc nulls last limit 16)
          union all
          (select x.film_id, x.val, x.prestige_score from public.cinecodex_axis x
            where x.code = tv.code and x.val > tv.val and x.film_id <> (select id from tgt)
            order by x.val asc, x.prestige_score desc nulls last limit 16)
        ) c2
        order by abs(c2.val - tv.val), c2.prestige_score desc nulls last, c2.film_id
        limit 3
      ) c join public.films f on f.id = c.film_id
    ) as films
    from tv
  ),
  selfrank as (select rn from public.cinecodex_rank where film_id = (select id from tgt)),
  total as (select max(rn) mx from public.cinecodex_rank),
  win as (
    select * from public.cinecodex_rank
    where rn between greatest(1, least((select rn from selfrank) - 10, (select mx from total) - 19))
                 and greatest(20, least((select rn from selfrank) + 9, (select mx from total)))
    order by rn limit 20
  ),
  basket as (
    select json_agg(json_build_object(
      'title', w.title, 'slug', w.slug, 'year', w.year, 'poster_path', w.poster_path,
      'rank', w.rn, 'u', w.u, 'r', w.r, 'self', w.film_id = (select id from tgt)) order by w.rn) rows,
      (select mx from total) total
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

-- Refresh both views after any scoring run. CONCURRENTLY needs the unique
-- indexes created above, and keeps readers online while it runs.
create or replace function public.cinecodex_refresh()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  refresh materialized view concurrently public.cinecodex_axis;
  refresh materialized view concurrently public.cinecodex_rank;
end
$function$;

revoke all on function public.cinecodex_refresh() from public, anon, authenticated;
grant execute on function public.cinecodex_refresh() to service_role;
