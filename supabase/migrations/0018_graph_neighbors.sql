-- 0018 — graph neighbor RPCs for the Obsidian-style node graph (force-directed map)
-- Each returns a node's DIRECT neighbors + an edge weight (relatedness).
-- SECURITY DEFINER + fixed search_path; published-only; granted to anon/authenticated.

-- film ↔ film  (weight = film_affinities.score)
create or replace function public.graph_film_neighbors(p_slug text, p_limit int default 12)
returns table(slug text, title text, year int, weight double precision)
language sql stable security definer set search_path = public as $$
  select rf.slug, rf.title, rf.year, fa.score::double precision
  from films f
  join film_affinities fa on fa.film_id = f.id
  join films rf on rf.id = fa.related_film_id
  where f.slug = p_slug
  order by fa.score desc
  limit p_limit;
$$;

-- meta-take ↔ meta-take  (weight = embedding cosine similarity, pgvector)
create or replace function public.graph_meta_take_neighbors(p_slug text, p_limit int default 12)
returns table(slug text, title text, weight double precision)
language sql stable security definer set search_path = public as $$
  with src as (
    select embedding from meta_takes
    where slug = p_slug and status = 'published' and embedding is not null
  )
  select m.slug, m.title,
         (1 - (m.embedding <=> (select embedding from src)))::double precision as weight
  from meta_takes m
  where m.status = 'published' and m.embedding is not null and m.slug <> p_slug
    and exists (select 1 from src)
  order by m.embedding <=> (select embedding from src)
  limit p_limit;
$$;

-- figure ↔ figure  (weight = # shared meta-takes; carries the figure's film)
create or replace function public.graph_figure_neighbors(p_film_slug text, p_figure_slug text, p_limit int default 12)
returns table(slug text, label text, film_slug text, film_title text, weight int)
language sql stable security definer set search_path = public as $$
  with src as (
    select f.id from figures f join films fl on fl.id = f.film_id
    where fl.slug = p_film_slug and f.slug = p_figure_slug
  ),
  src_mt as (
    select distinct t.meta_take_id
    from takes t
    where t.figure_id = (select id from src)
      and t.meta_take_id is not null and t.status = 'published'
  ),
  nbr as (
    select t.figure_id, count(distinct t.meta_take_id) as shared
    from takes t
    where t.meta_take_id in (select meta_take_id from src_mt)
      and t.status = 'published'
      and t.figure_id <> (select id from src)
    group by t.figure_id
  )
  select f.slug, f.label, fl.slug as film_slug, fl.title as film_title, n.shared::int as weight
  from nbr n
  join figures f on f.id = n.figure_id
  join films fl on fl.id = f.film_id
  order by n.shared desc, f.label
  limit p_limit;
$$;

-- take 3-node: sibling takes on the same meta-take (take → meta-take → kindred takes)
create or replace function public.graph_meta_take_siblings(p_mt_slug text, p_exclude uuid, p_limit int default 10)
returns table(take_id uuid, label text, figure_slug text, film_slug text, film_title text)
language sql stable security definer set search_path = public as $$
  select t.id as take_id, f.label, f.slug as figure_slug, fl.slug as film_slug, fl.title as film_title
  from takes t
  join meta_takes m on m.id = t.meta_take_id
  join figures f on f.id = t.figure_id
  join films fl on fl.id = f.film_id
  where m.slug = p_mt_slug and m.status = 'published' and t.status = 'published'
    and (p_exclude is null or t.id <> p_exclude)
  order by t.confidence desc nulls last
  limit p_limit;
$$;

revoke all on function public.graph_film_neighbors(text,int) from public;
revoke all on function public.graph_meta_take_neighbors(text,int) from public;
revoke all on function public.graph_figure_neighbors(text,text,int) from public;
revoke all on function public.graph_meta_take_siblings(text,uuid,int) from public;
grant execute on function public.graph_film_neighbors(text,int) to anon, authenticated;
grant execute on function public.graph_meta_take_neighbors(text,int) to anon, authenticated;
grant execute on function public.graph_figure_neighbors(text,text,int) to anon, authenticated;
grant execute on function public.graph_meta_take_siblings(text,uuid,int) to anon, authenticated;
