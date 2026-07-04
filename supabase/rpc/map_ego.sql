-- map_ego — ego-network graph for /map and per-page EntityMap embeds.
-- 2026-07-04: versioned into repo (was DB-only) + determinism fix:
--   hub-film sampling in the film/figure branches used ORDER BY random(),
--   which made every render a different graph and defeated caching.
--   Now ordered by figure_type_members.sim DESC (strongest members first), slug ASC.
-- Applied via migration map_ego_deterministic.

CREATE OR REPLACE FUNCTION public.map_ego(p_type text, p_key text, p_key2 text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r jsonb; kt text := lower(coalesce(p_type,'')); v_rslug text; v_name text;
begin
  if kt = 'film' then
    with cf as (select id,slug,title,director,director_slug from films where slug=p_key),
    figs as (select f.id fid,f.slug fslug,f.label from figures f
       where f.film_id=(select id from cf) and f.slug is not null
         and exists(select 1 from takes t where t.figure_id=f.id and t.status='published')
       order by (select count(*) from takes t where t.figure_id=f.id and t.status='published') desc, f.id
       limit 9),
    ft as (select fslug,tslug,ttitle from (select figs.fslug, m.slug tslug, m.title ttitle,
         row_number() over(partition by figs.fslug order by m.title) rk
       from figs join figure_type_members fm on fm.figure_id=figs.fid
       join meta_takes m on m.id=fm.meta_take_id and m.kind='figure_type' and m.slug is not null) z where rk<=2),
    fi as (select fslug,cslug,cname from (select figs.fslug, coalesce(c.canon_slug,c.slug) cslug, coalesce(c.canon_name,c.name) cname,
         row_number() over(partition by figs.fslug order by c.n desc nulls last) rk
       from figs join takes t on t.figure_id=figs.fid and t.status='published'
       join sm_concepts c on exists (select 1 from public.concept_map k9 where k9.raw_l=lower(btrim(t.concept)) and k9.concept_id=c.id) where t.concept is not null) z where rk<=2),
    dir as (select (select director_slug from cf) slug, (select director from cf) name where (select director_slug from cf) is not null),
    hf as (select tslug, filmslug, title from (
        select ft.tslug, fl.slug filmslug, fl.title,
          row_number() over(partition by ft.tslug order by fm.sim desc nulls last, fl.slug) rk
        from ft join meta_takes m on m.slug=ft.tslug and m.kind='figure_type'
        join figure_type_members fm on fm.meta_take_id=m.id
        join figures f2 on f2.id=fm.figure_id and f2.id not in (select fid from figs)
        join films fl on fl.id=f2.film_id
        where fl.visible and fl.slug is not null and fl.slug<>(select slug from cf)
      ) z where rk<=2 limit 10),
    nodes as (
      select 'film:'||(select slug from cf) id,'film' type,true center,(select title from cf) label, coalesce('dir. '||(select director from cf),'film') sub,'/film/'||(select slug from cf) href
      union all select distinct 'fig:'||(select slug from cf)||'/'||fslug,'figure',false,label,'figure','/film/'||(select slug from cf)||'/figure/'||fslug from figs
      union all select distinct 'trope:'||tslug,'trope',false,ttitle,'trope','/trope/'||tslug from ft
      union all select distinct 'idea:'||cslug,'idea',false,cname,'idea','/idea/'||cslug from fi
      union all select 'dir:'||slug,'director',false,name,'director','/director/'||slug from dir
      union all select distinct 'film:'||filmslug,'film',false,title,'film','/film/'||filmslug from hf
    ),
    edges as (
      select 'film:'||(select slug from cf) s,'fig:'||(select slug from cf)||'/'||fslug t,'struct' kind from figs
      union all select 'fig:'||(select slug from cf)||'/'||fslug,'trope:'||tslug,'trope' from ft
      union all select 'fig:'||(select slug from cf)||'/'||fslug,'idea:'||cslug,'idea' from fi
      union all select 'film:'||(select slug from cf),'dir:'||slug,'struct' from dir
      union all select 'trope:'||tslug,'film:'||filmslug,'trope' from hf
    )
    select jsonb_build_object(
      'nodes',coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'label',label,'sub',sub,'href',href,'center',center)) from nodes),'[]'::jsonb),
      'links',coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind)) from edges),'[]'::jsonb)) into r;

  elsif kt = 'figure' then
    with cf as (select f.id fid,f.slug fslug,f.label,fl.slug filmslug,fl.title ftitle
       from figures f join films fl on fl.id=f.film_id where fl.slug=p_key and f.slug=p_key2),
    tt as (select m.slug tslug,m.title ttitle from cf join figure_type_members fm on fm.figure_id=cf.fid
       join meta_takes m on m.id=fm.meta_take_id and m.kind='figure_type' and m.slug is not null group by m.slug,m.title limit 8),
    ii as (select coalesce(c.canon_slug,c.slug) cslug,coalesce(c.canon_name,c.name) cname from cf
       join takes t on t.figure_id=cf.fid and t.status='published'
       join sm_concepts c on exists (select 1 from public.concept_map k9 where k9.raw_l=lower(btrim(t.concept)) and k9.concept_id=c.id) group by coalesce(c.canon_slug,c.slug),coalesce(c.canon_name,c.name) limit 8),
    hh as (select th.slug,th.name from cf join takes t on t.figure_id=cf.fid and t.status='published'
       join theorists th on th.id=t.theorist_id where th.slug is not null group by th.slug,th.name limit 6),
    hf as (select tslug, filmslug, title from (
        select tt.tslug, fl.slug filmslug, fl.title,
          row_number() over(partition by tt.tslug order by fm.sim desc nulls last, fl.slug) rk
        from tt join meta_takes m on m.slug=tt.tslug and m.kind='figure_type'
        join figure_type_members fm on fm.meta_take_id=m.id
        join figures f2 on f2.id=fm.figure_id and f2.id<>(select fid from cf)
        join films fl on fl.id=f2.film_id
        where fl.visible and fl.slug is not null and fl.slug<>(select filmslug from cf)
      ) z where rk<=2 limit 10),
    nodes as (
      select 'fig:'||(select filmslug from cf)||'/'||(select fslug from cf) id,'figure' type,true center,(select label from cf) label,(select ftitle from cf) sub,'/film/'||(select filmslug from cf)||'/figure/'||(select fslug from cf) href
      union all select 'film:'||(select filmslug from cf),'film',false,(select ftitle from cf),'film','/film/'||(select filmslug from cf)
      union all select distinct 'trope:'||tslug,'trope',false,ttitle,'trope','/trope/'||tslug from tt
      union all select distinct 'idea:'||cslug,'idea',false,cname,'idea','/idea/'||cslug from ii
      union all select distinct 'theo:'||slug,'theorist',false,name,'theorist','/theorist/'||slug from hh
      union all select distinct 'film:'||filmslug,'film',false,title,'film','/film/'||filmslug from hf
    ),
    edges as (
      select 'fig:'||(select filmslug from cf)||'/'||(select fslug from cf) s,'film:'||(select filmslug from cf) t,'struct' kind
      union all select 'fig:'||(select filmslug from cf)||'/'||(select fslug from cf),'trope:'||tslug,'trope' from tt
      union all select 'fig:'||(select filmslug from cf)||'/'||(select fslug from cf),'idea:'||cslug,'idea' from ii
      union all select 'fig:'||(select filmslug from cf)||'/'||(select fslug from cf),'theo:'||slug,'reading' from hh
      union all select 'trope:'||tslug,'film:'||filmslug,'trope' from hf
    )
    select jsonb_build_object(
      'nodes',coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'label',label,'sub',sub,'href',href,'center',center)) from nodes),'[]'::jsonb),
      'links',coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind)) from edges),'[]'::jsonb)) into r;

  elsif kt = 'trope' then
    with ct as (select id,slug,title from meta_takes where slug=p_key and kind='figure_type'),
    mem as (select fslug,filmslug,label from (select f.slug fslug,fl.slug filmslug,f.label,max(fm.sim) s
         from figure_type_members fm join figures f on f.id=fm.figure_id join films fl on fl.id=f.film_id
         where fm.meta_take_id=(select id from ct) and f.slug is not null group by f.slug,fl.slug,f.label order by max(fm.sim) desc nulls last limit 18) z),
    flm as (select distinct filmslug from mem)
    , nodes as (
      select 'trope:'||(select slug from ct) id,'trope' type,true center,(select title from ct) label,'trope' sub,'/trope/'||(select slug from ct) href
      union all select distinct 'fig:'||filmslug||'/'||fslug,'figure',false,label,'figure','/film/'||filmslug||'/figure/'||fslug from mem
      union all select distinct 'film:'||filmslug,'film',false,filmslug,'film','/film/'||filmslug from flm
    ),
    edges as (
      select 'trope:'||(select slug from ct) s,'fig:'||filmslug||'/'||fslug t,'trope' kind from mem
      union all select 'fig:'||filmslug||'/'||fslug,'film:'||filmslug,'struct' from mem
    )
    select jsonb_build_object(
      'nodes',coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'label',label,'sub',sub,'href',href,'center',center)) from nodes),'[]'::jsonb),
      'links',coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind)) from edges),'[]'::jsonb)) into r;

  elsif kt = 'idea' then
    select resolved_slug, name into v_rslug, v_name from sm_concept_head(p_key) limit 1;
    if v_rslug is null then v_rslug := p_key; end if;
    with rd as (select * from sm_concept_readings(v_rslug, 80)),
    mem as (select distinct fig_slug,film_slug,fig_label,film_title from rd where fig_slug is not null and film_slug is not null limit 18),
    flm as (select distinct film_slug,film_title from rd where film_slug is not null limit 18),
    hh as (select distinct theorist_slug,theorist_name from rd where theorist_slug is not null limit 6),
    nodes as (
      select 'idea:'||v_rslug id,'idea' type,true center,coalesce(v_name,v_rslug) label,'idea' sub,'/idea/'||v_rslug href
      union all select distinct 'fig:'||film_slug||'/'||fig_slug,'figure',false,fig_label,film_title,'/film/'||film_slug||'/figure/'||fig_slug from mem
      union all select distinct 'film:'||film_slug,'film',false,film_title,'film','/film/'||film_slug from flm
      union all select distinct 'theo:'||theorist_slug,'theorist',false,theorist_name,'theorist','/theorist/'||theorist_slug from hh
    ),
    edges as (
      select 'idea:'||v_rslug s,'fig:'||film_slug||'/'||fig_slug t,'idea' kind from mem
      union all select 'fig:'||film_slug||'/'||fig_slug,'film:'||film_slug,'struct' from mem
      union all select 'idea:'||v_rslug,'theo:'||theorist_slug,'reading' from hh
    )
    select jsonb_build_object(
      'nodes',coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'label',label,'sub',sub,'href',href,'center',center)) from nodes),'[]'::jsonb),
      'links',coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind)) from edges),'[]'::jsonb)) into r;

  elsif kt = 'director' then
    with cd as (select p_key slug, coalesce(
        (select name from directors where slug=p_key),
        (select max(director) from films where director_slug=p_key)
      ) name),
    flm as (select slug,title from films where director_slug=p_key and visible order by year desc nulls last limit 14),
    fg as (select filmslug,fslug,label from (
       select fl.slug filmslug, f.slug fslug, f.label,
         row_number() over(partition by fl.slug order by (select count(*) from takes t2 where t2.figure_id=f.id and t2.status='published') desc) rk
       from films fl join figures f on f.film_id=fl.id
       where fl.director_slug=p_key and fl.slug in (select slug from flm) and f.slug is not null
         and exists(select 1 from takes t where t.figure_id=f.id and t.status='published')) x where rk<=2),
    nodes as (
      select 'dir:'||(select slug from cd) id,'director' type,true center,coalesce((select name from cd),(select slug from cd)) label,'director' sub,'/director/'||(select slug from cd) href
      union all select distinct 'film:'||slug,'film',false,title,'film','/film/'||slug from flm
      union all select distinct 'fig:'||filmslug||'/'||fslug,'figure',false,label,'figure','/film/'||filmslug||'/figure/'||fslug from fg
    ),
    edges as (
      select 'dir:'||(select slug from cd) s,'film:'||slug t,'struct' kind from flm
      union all select 'film:'||filmslug,'fig:'||filmslug||'/'||fslug,'struct' from fg
    )
    select jsonb_build_object(
      'nodes',coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'label',label,'sub',sub,'href',href,'center',center)) from nodes),'[]'::jsonb),
      'links',coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind)) from edges),'[]'::jsonb)) into r;

  elsif kt = 'theorist' then
    with cth as (select id,slug,name from theorists where slug=p_key),
    mem as (select fl.slug filmslug,f.slug fslug,f.label,fl.title ftitle from takes t join figures f on f.id=t.figure_id join films fl on fl.id=f.film_id
       where t.theorist_id=(select id from cth) and t.status='published' and f.slug is not null group by fl.slug,f.slug,f.label,fl.title limit 16),
    flm as (select distinct filmslug,ftitle from mem),
    ii as (select coalesce(c.canon_slug,c.slug) cslug,coalesce(c.canon_name,c.name) cname from takes t
       join sm_concepts c on exists (select 1 from public.concept_map k9 where k9.raw_l=lower(btrim(t.concept)) and k9.concept_id=c.id) where t.theorist_id=(select id from cth) and t.status='published'
       group by coalesce(c.canon_slug,c.slug),coalesce(c.canon_name,c.name) order by count(*) desc limit 6),
    nodes as (
      select 'theo:'||(select slug from cth) id,'theorist' type,true center,(select name from cth) label,'theorist' sub,'/theorist/'||(select slug from cth) href
      union all select distinct 'fig:'||filmslug||'/'||fslug,'figure',false,label,ftitle,'/film/'||filmslug||'/figure/'||fslug from mem
      union all select distinct 'film:'||filmslug,'film',false,ftitle,'film','/film/'||filmslug from flm
      union all select distinct 'idea:'||cslug,'idea',false,cname,'idea','/idea/'||cslug from ii
    ),
    edges as (
      select 'theo:'||(select slug from cth) s,'fig:'||filmslug||'/'||fslug t,'reading' kind from mem
      union all select 'fig:'||filmslug||'/'||fslug,'film:'||filmslug,'struct' from mem
      union all select 'theo:'||(select slug from cth),'idea:'||cslug,'idea' from ii
    )
    select jsonb_build_object(
      'nodes',coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'label',label,'sub',sub,'href',href,'center',center)) from nodes),'[]'::jsonb),
      'links',coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind)) from edges),'[]'::jsonb)) into r;
  end if;

  return coalesce(r, jsonb_build_object('nodes','[]'::jsonb,'links','[]'::jsonb));
end $function$;
