-- 0046 — cinecodex_card v2 for the public appraisal redesign.
-- 1. basket: fixed 5-anchor set → a 20-row U-rank WINDOW around the film
--    (10 above + self + 9 below, clamped at the edges of the ranking) so the
--    film's position reads naturally; rows gain rank / year / poster_path.
-- 2. comps: per-dimension neighbours upgrade from bare titles to
--    {title, slug, poster_path} objects so the UI can thumbnail + link them.
-- Return type stays `json` → CREATE OR REPLACE is safe. Consumers updated in
-- the same deploy: public /takescore/film/[slug], room EvalCard.
CREATE OR REPLACE FUNCTION public.cinecodex_card(p_slug text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cinecodex'
AS $function$
  with tgt as (
    select f.id, f.slug, f.title, f.year, f.director, f.poster_path
    from public.films f where f.slug = p_slug
  ),
  best as (
    select distinct on (s.film_id) s.film_id, s.cog,s.aff,s.form,s.moral,s.dur,
      s.itx,s.fr,s.etx,s.ctx,s.bank,s.insincere,s.coward,s.polar,
      s.v_value,s.c_cost,s.r_risk,s.n_samples,s.sd_v,s.sd_r,s.panel,s.prompt_version,s.flagged,s.scored_at
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  b as (select * from best where film_id = (select id from tgt)),
  long as (
    select bb.film_id, v.code, v.val
    from best bb, lateral (values
      ('cog',bb.cog),('aff',bb.aff),('form',bb.form),('moral',bb.moral),('dur',bb.dur),
      ('itx',bb.itx),('fr',bb.fr),('etx',bb.etx),('ctx',bb.ctx),
      ('bank',bb.bank),('insincere',bb.insincere),('coward',bb.coward),('polar',bb.polar)
    ) v(code,val)
  ),
  tv as (select code, val from long where film_id = (select id from tgt)),
  comps as (
    select code, json_agg(json_build_object('title', title, 'slug', slug, 'poster_path', poster_path)
                          order by rn) filter (where rn <= 3) films
    from (
      select l.code, f.title, f.slug, f.poster_path,
        row_number() over (partition by l.code order by abs(l.val - t.val), fs.prestige_score desc nulls last) rn
      from long l
      join tv t on t.code = l.code
      join public.films f on f.id = l.film_id and f.visible
      left join public.film_scores fs on fs.film_id = l.film_id
      where l.film_id <> (select id from tgt)
    ) q group by code
  ),
  ranked as (
    select f.id, f.slug, f.title, f.year, f.poster_path,
           round(bx.v_value - bx.r_risk) u, round(bx.r_risk) r,
           row_number() over (order by (bx.v_value - bx.r_risk) desc,
                                        fsc.prestige_score desc nulls last, f.slug) rn
    from public.films f
    join best bx on bx.film_id = f.id
    left join public.film_scores fsc on fsc.film_id = f.id
    where f.visible
  ),
  selfrank as (select rn from ranked where id = (select id from tgt)),
  win as (
    -- 20-row window: 10 above + self + 9 below, clamped to the list edges so
    -- top/bottom films still show a full 20.
    select * from ranked
    where rn between
      greatest(1, least((select rn from selfrank) - 10,
                        (select max(rn) from ranked) - 19))
      and
      greatest(20, least((select rn from selfrank) + 9, (select max(rn) from ranked)))
    order by rn
    limit 20
  ),
  basket as (
    select json_agg(json_build_object(
             'title', w.title, 'slug', w.slug, 'year', w.year, 'poster_path', w.poster_path,
             'rank', w.rn, 'u', w.u, 'r', w.r,
             'self', w.id = (select id from tgt)) order by w.rn) rows,
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
