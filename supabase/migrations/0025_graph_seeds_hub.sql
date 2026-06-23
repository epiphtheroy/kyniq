-- 0025 — graph seed RPCs for the hub pages (meta-take / trope), mirror of 0024.
-- Same { nodes, links } shape, same EntityGraph renderer. Inverts the figure graph:
-- a reading or a trope at the centre, surrounded by the figures (across films) that
-- embody it.  SECURITY DEFINER, anon-safe, published-gated.
--
--  graph_metatake_seed : reading → member figures (across films) + neighbouring
--                        readings (embedding cosine). The cross-film "cases".
--  graph_trope_seed    : trope   → member figures (across films) + the readings
--                        those figures receive (= what this device tends to MEAN).
-- Note: figure_type meta-takes are not embedded, so the trope graph has no
-- "sibling tropes" branch — the two strong axes (figures + meanings) instead.

-- ── META-TAKE (reading) seed ────────────────────────────────────────────────
create or replace function public.graph_metatake_seed(p_slug text, p_members int default 14, p_neighbors int default 6)
returns jsonb language sql stable security definer set search_path = public as $$
  with cm as (select id, slug, title, embedding from meta_takes
              where slug = p_slug and kind = 'reading' and status = 'published'),
  mem as (
    select distinct on (f.id) f.id, f.label, f.slug figslug, fl.slug film, fl.title ftitle, t.confidence
    from takes t join figures f on f.id = t.figure_id join films fl on fl.id = f.film_id
    where t.meta_take_id = (select id from cm) and t.status = 'published' and f.slug is not null
    order by f.id, t.confidence desc nulls last
  ),
  mem2 as (select * from mem order by confidence desc nulls last limit p_members),
  nbr as (
    select m.slug, m.title
    from meta_takes m, cm
    where m.kind = 'reading' and m.status = 'published' and m.embedding is not null
      and cm.embedding is not null and m.id <> cm.id
    order by m.embedding <=> cm.embedding
    limit p_neighbors
  ),
  nodes as (
    select 'C' id, 'reading' type, true center, (select title from cm) label,
           (select count(distinct film) from mem)::text || ' films' sub, '/take/'||(select slug from cm) href
    union all
    select 'k:'||film||'/'||figslug, 'figure', false, label, ftitle, '/film/'||film||'/figure/'||figslug from mem2
    union all
    select 'n:'||slug, 'reading', false, title, 'related reading', '/take/'||slug from nbr
  ),
  edges as (
    select 'C' s, 'k:'||film||'/'||figslug t, 'reading' kind from mem2
    union all select 'C', 'n:'||slug, 'reading' from nbr
  )
  select jsonb_build_object(
    'nodes', coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'center',center,'label',label,'sub',sub,'href',href)) from nodes), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind)) from edges), '[]'::jsonb)
  );
$$;

-- ── TROPE (figure_type) seed ────────────────────────────────────────────────
create or replace function public.graph_trope_seed(p_slug text, p_members int default 14, p_readings int default 6)
returns jsonb language sql stable security definer set search_path = public as $$
  with ct as (select id, slug, title from meta_takes
              where slug = p_slug and kind = 'figure_type' and status = 'published'),
  mem as (
    select f.id, f.label, f.slug figslug, fl.slug film, fl.title ftitle, fm.sim
    from figure_type_members fm join figures f on f.id = fm.figure_id join films fl on fl.id = f.film_id
    where fm.meta_take_id = (select id from ct) and f.slug is not null
    order by fm.sim desc nulls last limit p_members
  ),
  rd as (
    select m.slug, m.title, m.status, count(distinct fm.figure_id) c
    from figure_type_members fm
    join takes t on t.figure_id = fm.figure_id and t.status = 'published'
    join meta_takes m on m.id = t.meta_take_id and m.kind = 'reading'
    where fm.meta_take_id = (select id from ct)
    group by m.slug, m.title, m.status
    order by count(distinct fm.figure_id) desc limit p_readings
  ),
  nodes as (
    select 'C' id, 'trope' type, true center, (select title from ct) label,
           (select count(distinct film) from mem)::text || ' films' sub, '/trope/'||(select slug from ct) href
    union all
    select 'k:'||film||'/'||figslug, 'figure', false, label, ftitle, '/film/'||film||'/figure/'||figslug from mem
    union all
    select 'r:'||slug, 'reading', false, title, 'reading · '||c||' here',
           case when status = 'published' then '/take/'||slug else null end from rd
  ),
  edges as (
    select 'C' s, 'k:'||film||'/'||figslug t, 'trope' kind from mem
    union all select 'C', 'r:'||slug, 'reading' from rd
  )
  select jsonb_build_object(
    'nodes', coalesce((select jsonb_agg(distinct jsonb_build_object('id',id,'type',type,'center',center,'label',label,'sub',sub,'href',href)) from nodes), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(distinct jsonb_build_object('s',s,'t',t,'kind',kind)) from edges), '[]'::jsonb)
  );
$$;

revoke all on function public.graph_metatake_seed(text,int,int) from public;
revoke all on function public.graph_trope_seed(text,int,int) from public;
grant execute on function public.graph_metatake_seed(text,int,int) to anon, authenticated;
grant execute on function public.graph_trope_seed(text,int,int) to anon, authenticated;
