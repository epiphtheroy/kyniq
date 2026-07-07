-- 0047 — cinecodex_for gains rank / rank_total (overall U-rank among visible
-- scored films, same ordering as cinecodex_card v2's ranked CTE) so the film
-- page's TakeScore panel can draw the overall-rank track in place of the
-- confidence bar. Additive json keys — existing consumers unaffected.
CREATE OR REPLACE FUNCTION public.cinecodex_for(p_slug text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cinecodex'
AS $function$
  with best as (
    select distinct on (s.film_id) s.*
    from cinecodex.scores s
    order by s.film_id, case s.panel when 'opus+sonnet' then 0 when 'sonnet-n3' then 1 else 2 end
  ),
  ranked as (
    select f.id, row_number() over (order by (b.v_value - b.r_risk) desc,
                                             fs.prestige_score desc nulls last, f.slug) rn,
           count(*) over () total
    from public.films f
    join best b on b.film_id = f.id
    left join public.film_scores fs on fs.film_id = f.id
    where f.visible
  )
  select json_build_object(
    'v', round(s.v_value,1), 'c', round(s.c_cost,1), 'r', round(s.r_risk,1),
    'u', round(s.v_value - s.r_risk, 1),
    'sharpe', round((s.v_value - 50)/greatest(s.r_risk,1), 2),
    'sub', json_build_object('Cognitive',s.cog,'Affective',s.aff,'Formal',s.form,'Moral',s.moral,'Durability',s.dur,
             'Intertextual',s.itx,'Formal radicalism',s.fr,'Extratextual',s.etx,'Auteur oeuvre',s.ctx,
             'Bankruptcy',s.bank,'Insincerity',s.insincere,'Cowardice',s.coward,'Polarization',s.polar),
    'n_samples', s.n_samples, 'sd_v', s.sd_v, 'panel', s.panel, 'flagged', s.flagged,
    'conf', cc.conf, 'conf_tier', cc.tier, 'n_takes', cc.n_takes, 'votes', cc.votes,
    'ext', json_build_object('imdb', r.imdb_rating, 'rt', r.rt_tomatometer, 'metascore', r.metascore),
    'rank', (select rn from ranked where id = f.id),
    'rank_total', (select max(total) from ranked)
  )
  from public.films f
  join best s on s.film_id = f.id
  left join public.cinecodex_confidence cc on cc.film_id = f.id
  left join public.film_ratings r on r.film_id = f.id
  where f.slug = p_slug;
$function$;
