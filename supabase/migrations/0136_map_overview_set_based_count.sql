-- 0136 — map_overview: stop counting every film to pick fourteen.
--
-- Measured 2026-08-06, the day the database fell over twice:
--
--   explain (analyze, buffers) select public.map_overview();
--   Buffers: shared hit=137536      Execution Time: 208 ms
--
-- 137,536 buffers is roughly a gigabyte of buffer traffic for one call. On a 2GB
-- instance that evicts most of the cache, so every other query afterwards reads
-- from disk. It is why ~44 requests a minute was enough to take the site down —
-- the load was not high, one query was simply enormous.
--
-- The cost is in the first CTE: a correlated subquery that counts published takes
-- for EVERY visible film (1,959 of them) and then keeps the top 14. One aggregate
-- pass computes the same thing once. Nothing about the result changes.
--
-- The index matters for the same reason: takes had (figure_id) alone, so filtering
-- status meant a heap fetch per row. (figure_id, status) keeps it in the index.
--
-- Everything below the first CTE is byte-identical to the previous definition.

create index if not exists idx_takes_figure_status
  on public.takes (figure_id, status);

create or replace function public.map_overview()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with cnt as (
    -- one pass, instead of one correlated subquery per film
    select g.film_id, count(*) c
    from takes t
    join figures g on g.id = t.figure_id
    where t.status = 'published'
    group by g.film_id
  ),
  tf as (select f.id fid,f.slug,f.title,f.director,f.director_slug, coalesce(cnt.c,0) c
     from films f left join cnt on cnt.film_id = f.id
     where f.visible order by c desc limit 14),
  figs as (select filmslug,fid,fslug,label from (
       select tf.slug filmslug, g.id fid, g.slug fslug, g.label,
         row_number() over(partition by tf.slug order by (select count(*) from takes t where t.figure_id=g.id and t.status='published') desc) rk
       from tf join figures g on g.film_id=tf.fid where g.slug is not null
         and exists(select 1 from takes t where t.figure_id=g.id and t.status='published')) x where rk<=2),
  ft as (select filmslug,fslug,tslug,ttitle from (select figs.filmslug,figs.fslug, m.slug tslug, m.title ttitle,
         row_number() over(partition by figs.fid order by fm.sim desc nulls last) rk
       from figs join figure_type_members fm on fm.figure_id=figs.fid
       join meta_takes m on m.id=fm.meta_take_id and m.kind='figure_type' and m.slug is not null) z where rk<=1),
  fi as (select filmslug,fslug,cslug,cname from (select figs.filmslug,figs.fslug, coalesce(c.canon_slug,c.slug) cslug, coalesce(c.canon_name,c.name) cname,
         row_number() over(partition by figs.fid order by c.n desc nulls last) rk
       from figs join takes t on t.figure_id=figs.fid and t.status='published'
       join sm_concepts c on exists (select 1 from public.concept_map k9 where k9.raw_l=lower(btrim(t.concept)) and k9.concept_id=c.id) where t.concept is not null) z where rk<=1),
  dir as (select distinct director_slug, director from tf where director_slug is not null and director is not null),
  nodes as (
    select 'film:'||slug id,'film' type,false center,title label,coalesce('dir. '||director,'film') sub,'/film/'||slug href from tf
    union all select distinct 'fig:'||filmslug||'/'||fslug,'figure',false,label,'figure','/film/'||filmslug||'/figure/'||fslug from figs
    union all select distinct 'trope:'||tslug,'trope',false,ttitle,'trope','/trope/'||tslug from ft
    union all select distinct 'idea:'||cslug,'idea',false,cname,'idea','/idea/'||cslug from fi
    union all select distinct 'dir:'||director_slug,'director',false,director,'director','/director/'||director_slug from dir
  ),
  edges as (
    select 'film:'||filmslug s,'fig:'||filmslug||'/'||fslug t,'struct' kind from figs
    union all select 'fig:'||filmslug||'/'||fslug,'trope:'||tslug,'trope' from ft
    union all select 'fig:'||filmslug||'/'||fslug,'idea:'||cslug,'idea' from fi
    union all select 'film:'||slug,'dir:'||director_slug,'struct' from tf where director_slug is not null
  )
  select jsonb_build_object(
    'nodes',coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'label',label,'sub',sub,'href',href,'center',center)) from nodes),'[]'::jsonb),
    'links',coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind)) from edges),'[]'::jsonb));
$function$;

-- After applying, confirm the win:
--   explain (analyze, buffers) select public.map_overview();
-- and compare the node/link counts against the old output before trusting it.
