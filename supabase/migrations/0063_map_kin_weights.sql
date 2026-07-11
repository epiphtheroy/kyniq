-- 0063: add kin weight (w) to film↔film "like" edges in the film ego graph.
-- (applied to prod 2026-07-11 via MCP "map_kin_weights"). Same signature →
-- create-or-replace. Only the `lik` CTE + edge/link jsonb change; every other
-- edge kind carries w=null. Preserves SECURITY DEFINER + search_path.
-- EntityGraph.tsx scales stroke width by w (film_kinship.kin, 0–100).
create or replace function public.map_film_ego(p_slug text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with cf as (select id,slug,title,year,director from films where slug=p_slug),
  fwd as (select fl.slug,fl.title from film_next fn join films fl on fl.id=fn.target_film_id
          where fn.source_film_id=(select id from cf) and fn.target_film_id is not null and fl.visible
          group by fl.slug,fl.title order by min(fn.position) limit 6),
  rev as (select fl.slug,fl.title from film_next fn join films fl on fl.id=fn.source_film_id
          where fn.target_film_id=(select id from cf) and fl.visible and fl.slug<>p_slug
          group by fl.slug,fl.title limit 5),
  lik as (select fl.slug,fl.title, max(k.kin) kin from film_affinities fa join films fl on fl.id=fa.related_film_id
          left join film_kinship k on k.film_id=fa.film_id and k.related_film_id=fa.related_film_id
          where fa.film_id=(select id from cf) and fl.visible and fl.slug<>p_slug
          group by fl.slug,fl.title order by max(fa.score) desc limit 7),
  cp as (select fl.slug, fl.title from entity_edges ee
         join films fl on fl.id=ee.dst_id
         where ee.kind='counterpoint' and ee.src_type='film' and ee.src_id=(select id from cf)
           and fl.visible and fl.slug<>p_slug
         order by ee.score desc, fl.slug limit 4),
  ring1 as (select slug,title from fwd union select slug,title from rev union select slug,title from lik union select slug,title from cp),
  r2 as (select srcslug, slug, title from (
      select r.slug srcslug, fl.slug slug, fl.title title,
        row_number() over (partition by f1.id order by fn.position) rk
      from ring1 r join films f1 on f1.slug=r.slug
      join film_next fn on fn.source_film_id=f1.id
      join films fl on fl.id=fn.target_film_id
      where fn.target_film_id is not null and fl.visible and fl.slug<>p_slug
        and fl.slug not in (select slug from ring1)
    ) z where rk<=1 limit 14),
  nodes as (
    select 'film:'||(select slug from cf) id,'film' type,true center,(select title from cf) label,null::text sub,'/film/'||(select slug from cf) href
    union all select distinct 'film:'||slug,'film',false,title,null::text,'/film/'||slug from fwd
    union all select distinct 'film:'||slug,'film',false,title,null::text,'/film/'||slug from rev
    union all select distinct 'film:'||slug,'film',false,title,null::text,'/film/'||slug from lik
    union all select distinct 'film:'||slug,'film',false,title,null::text,'/film/'||slug from cp
    union all select distinct 'film:'||slug,'film',false,title,null::text,'/film/'||slug from r2
  ),
  edges as (
    select 'film:'||(select slug from cf) s,'film:'||slug t,'next' kind, true arrow, null::numeric w from fwd
    union all select 'film:'||slug,'film:'||(select slug from cf),'recby', true, null::numeric from rev
    union all select 'film:'||(select slug from cf),'film:'||slug,'like', false, kin from lik
    union all select 'film:'||(select slug from cf),'film:'||slug,'counter', false, null::numeric from cp
    union all select 'film:'||srcslug,'film:'||slug,'next', true, null::numeric from r2
  )
  select jsonb_build_object(
    'nodes',coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'label',label,'sub',sub,'href',href,'center',center)) from nodes),'[]'::jsonb),
    'links',coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind,'arrow',arrow,'w',w)) from edges),'[]'::jsonb));
$function$;
