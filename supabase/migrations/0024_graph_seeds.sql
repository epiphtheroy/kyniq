-- 0024 — graph seed RPCs for the Obsidian-style force graph (film page + figure page)
-- Each returns a graph-ready { nodes, links } jsonb for ONE entity's ego-network,
-- so the client renders directly (no client-side assembly). SECURITY DEFINER, anon-safe.
--
-- Node shape : { id, type, center, label, sub, href }   type ∈ film|figure|reading|trope
-- Link shape : { s, t, kind }                            kind ∈ struct|reading|trope
--
-- href rules: figure & film pages are always live → href set.
--   reading hubs: only meta_takes.status='published' get a /take link (274 of ~4142 today);
--   un-published (candidate) reading hubs still appear as nodes (the connection is real,
--   takes are all published) but with href=null → the client shows them, doesn't link them.
--   trope hubs are all published → always /trope link.
-- takes are gated status='published' (currently a no-op, all 18,004 are published) for safety.

-- ─────────────────────────────────────────────────────────────────────────────
-- FIGURE seed: figure → its readings(meta-take) + tropes → kin figures (other films)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.graph_figure_seed(p_film_slug text, p_figure_slug text, p_kin int default 6)
returns jsonb language sql stable security definer set search_path = public as $$
  with cf as (
    select f.id, f.label, f.slug figslug, fl.slug film, fl.title ftitle
    from figures f join films fl on fl.id = f.film_id
    where fl.slug = p_film_slug and f.slug = p_figure_slug
  ),
  rd as (
    select m.id, m.slug, m.title, m.status,
      (select min(t2.register) from takes t2 where t2.figure_id = (select id from cf) and t2.meta_take_id = m.id) reg,
      (select count(distinct f2.id) from takes t3 join figures f2 on f2.id = t3.figure_id
        where t3.meta_take_id = m.id and t3.status = 'published' and f2.id <> (select id from cf)) figs
    from (select distinct mm.id, mm.slug, mm.title, mm.status
          from takes t join meta_takes mm on mm.id = t.meta_take_id and mm.kind = 'reading'
          where t.figure_id = (select id from cf) and t.status = 'published') m
  ),
  rd2 as (select * from rd where status = 'published' or figs > 0),
  tp as (
    select m.id, m.slug, m.title,
      (select count(distinct f2.id) from figure_type_members fm2 join figures f2 on f2.id = fm2.figure_id
        where fm2.meta_take_id = m.id and f2.id <> (select id from cf)) figs
    from (select distinct mm.id, mm.slug, mm.title
          from figure_type_members fm join meta_takes mm on mm.id = fm.meta_take_id and mm.kind = 'figure_type'
          where fm.figure_id = (select id from cf)) m
  ),
  rk as (
    select rd2.slug hub, 'reading' kind, x.label, x.figslug, x.film, x.ftitle
    from rd2 cross join lateral (
      select f2.label, f2.slug figslug, fl2.slug film, fl2.title ftitle
      from takes t2 join figures f2 on f2.id = t2.figure_id join films fl2 on fl2.id = f2.film_id
      where t2.meta_take_id = rd2.id and t2.status = 'published' and f2.id <> (select id from cf)
      order by t2.confidence desc nulls last limit p_kin) x
  ),
  tk as (
    select tp.slug hub, 'trope' kind, x.label, x.figslug, x.film, x.ftitle
    from tp cross join lateral (
      select f2.label, f2.slug figslug, fl2.slug film, fl2.title ftitle
      from figure_type_members fm2 join figures f2 on f2.id = fm2.figure_id join films fl2 on fl2.id = f2.film_id
      where fm2.meta_take_id = tp.id and f2.id <> (select id from cf) limit p_kin) x
  ),
  allkin as (select * from rk union all select * from tk),
  nodes as (
    select 'C' id, 'figure' type, true center, (select label from cf) label, (select ftitle from cf) sub,
           '/film/'||(select film from cf)||'/figure/'||(select figslug from cf) href
    union all
    select 'h:'||slug, 'reading', false, title, coalesce(reg,'reading')||' · '||figs||' figures',
           case when status = 'published' then '/take/'||slug else null end from rd2
    union all
    select 'h:'||slug, 'trope', false, title, figs||' figures', '/trope/'||slug from tp
    union all
    select distinct 'k:'||film||'/'||figslug, 'figure', false, label, ftitle,
           '/film/'||film||'/figure/'||figslug from allkin
  ),
  edges as (
    select 'C' s, 'h:'||slug t, 'reading' kind from rd2
    union all select 'C', 'h:'||slug, 'trope' from tp
    union all select 'h:'||hub, 'k:'||film||'/'||figslug, kind from allkin
  )
  select jsonb_build_object(
    'nodes', coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'center',center,'label',label,'sub',sub,'href',href)) from nodes), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind)) from edges), '[]'::jsonb)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FILM seed: film → figures → each figure's reading(s)+trope → connected films
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.graph_film_seed(p_slug text, p_figs int default 6, p_hub_films int default 4)
returns jsonb language sql stable security definer set search_path = public as $$
  with cf as (select id, slug, title from films where slug = p_slug),
  fsel as (
    select fid,label,figslug from (
      select f.id fid, f.label, f.slug figslug,
        row_number() over (order by (select count(*) from takes t where t.figure_id=f.id and t.status='published') desc, f.id) rk
      from figures f
      where f.film_id=(select id from cf) and exists(select 1 from takes t where t.figure_id=f.id and t.status='published')
    ) z where rk <= p_figs
  ),
  rh as (
    select fid,figslug,hubid,hub,htitle,status,reg,figs from (
      select f.fid,f.figslug,m.id hubid,m.slug hub,m.title htitle,m.status,min(t.register) reg,
        (select count(distinct f2.film_id) from takes t2 join figures f2 on f2.id=t2.figure_id
          where t2.meta_take_id=m.id and t2.status='published' and f2.film_id<>(select id from cf)) figs,
        row_number() over (partition by f.fid order by
          (select count(distinct f2.film_id) from takes t2 join figures f2 on f2.id=t2.figure_id where t2.meta_take_id=m.id) desc) rk
      from fsel f join takes t on t.figure_id=f.fid and t.status='published'
        join meta_takes m on m.id=t.meta_take_id and m.kind='reading'
      group by f.fid,f.figslug,m.id,m.slug,m.title,m.status
    ) z where rk <= 2
  ),
  th as (
    select fid,figslug,hubid,hub,htitle,figs from (
      select f.fid,f.figslug,m.id hubid,m.slug hub,m.title htitle,
        (select count(distinct f2.film_id) from figure_type_members fm2 join figures f2 on f2.id=fm2.figure_id
          where fm2.meta_take_id=m.id and f2.film_id<>(select id from cf)) figs,
        row_number() over (partition by f.fid order by
          (select count(distinct f2.film_id) from figure_type_members fm2 join figures f2 on f2.id=fm2.figure_id where fm2.meta_take_id=m.id) desc) rk
      from fsel f join figure_type_members fm on fm.figure_id=f.fid
        join meta_takes m on m.id=fm.meta_take_id and m.kind='figure_type'
      group by f.fid,f.figslug,m.id,m.slug,m.title
    ) z where rk <= 1
  ),
  rhf as (select rh.hub, x.title, x.slug from rh cross join lateral (
      select distinct fl.title, fl.slug from takes t2 join figures f2 on f2.id=t2.figure_id join films fl on fl.id=f2.film_id
      where t2.meta_take_id=rh.hubid and t2.status='published' and fl.id<>(select id from cf) limit p_hub_films) x),
  thf as (select th.hub, x.title, x.slug from th cross join lateral (
      select distinct fl.title, fl.slug from figure_type_members fm2 join figures f2 on f2.id=fm2.figure_id join films fl on fl.id=f2.film_id
      where fm2.meta_take_id=th.hubid and fl.id<>(select id from cf) limit p_hub_films) x),
  nodes as (
    select 'C' id,'film' type,true center,(select title from cf) label,'film' sub,'/film/'||(select slug from cf) href
    union all select distinct 'f:'||figslug,'figure',false,label,'figure','/film/'||(select slug from cf)||'/figure/'||figslug from fsel
    union all select distinct 'h:'||hub,'reading',false,htitle,coalesce(reg,'reading')||' · '||figs||' films',
                     case when status='published' then '/take/'||hub else null end
              from rh where exists(select 1 from rhf where rhf.hub=rh.hub)
    union all select distinct 'h:'||hub,'trope',false,htitle,figs||' films','/trope/'||hub
              from th where exists(select 1 from thf where thf.hub=th.hub)
    union all select distinct 'm:'||slug,'film',false,title,'film','/film/'||slug from (select title,slug from rhf union select title,slug from thf) u
  ),
  edges as (
    select 'C' s,'f:'||figslug t,'struct' kind from fsel
    union all select 'f:'||figslug,'h:'||hub,'reading' from rh where exists(select 1 from rhf where rhf.hub=rh.hub)
    union all select 'f:'||figslug,'h:'||hub,'trope' from th where exists(select 1 from thf where thf.hub=th.hub)
    union all select 'h:'||hub,'m:'||slug,'reading' from rhf
    union all select 'h:'||hub,'m:'||slug,'trope' from thf
  )
  select jsonb_build_object(
    'nodes', coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'center',center,'label',label,'sub',sub,'href',href)) from nodes), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind)) from edges), '[]'::jsonb)
  );
$$;

revoke all on function public.graph_figure_seed(text,text,int) from public;
revoke all on function public.graph_film_seed(text,int,int) from public;
grant execute on function public.graph_figure_seed(text,text,int) to anon, authenticated;
grant execute on function public.graph_film_seed(text,int,int) to anon, authenticated;
