-- 0040_search_v3.sql — Unified search (Phase 1+2 of the search overhaul, 2026-07-06)
--
-- search_all      : one lexical RPC over every public entity type —
--                   films (Tier-2 catalog included at a 0.8 discount), directors, tropes,
--                   readings, figures, theorists, ideas/concepts, traditions,
--                   lineage lists, movements/national cinemas, archetypes.
-- search_semantic : pgvector legs over takes / meta_takes / film_taste_vector /
--                   director_embedding / theory_canon / taxonomy_nodes.
--                   Fused with search_all in the API layer via RRF (lib/search.ts).
-- film_search     : v2 — adds original_title matching and Tier-2 catalog rows (is_catalog).
--
-- Result-row contract shared by both RPCs (and mirrored in lib/search.ts):
--   kind text, slug text, film_slug text, title text, sub text,
--   poster text, year int, score real, is_catalog boolean
-- For kind='archetype' the film_slug column carries the taxonomy kind
-- (mapped to /catalog/{seg}/{slug} via lib/catalog.ts kindMeta).
--
-- Unlike earlier search RPCs (map_search, search_site v2 — live-DB only),
-- this file is the single source of truth: applied live AND committed here.

create extension if not exists pg_trgm;

-- Trigram indexes for the new big-table lexical surfaces. The small vocab tables
-- (theorists, sm_concepts, theory_canon, lineage_lists, curation.hub,
-- taxonomy_nodes — all ≤3k rows) seq-scan in well under a millisecond.
create index if not exists idx_films_original_title_trgm on public.films using gin (original_title gin_trgm_ops);
create index if not exists idx_takes_take_title_trgm     on public.takes using gin (take_title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- search_all — lexical, all entities
-- ---------------------------------------------------------------------------
drop function if exists public.search_all(text, integer);
create function public.search_all(p_q text, p_limit integer default 60)
returns table(kind text, slug text, film_slug text, title text, sub text, poster text, year integer, score real, is_catalog boolean)
language sql stable security definer
set search_path to 'public', 'curation'
set statement_timeout to '8s'
as $$
with q as (select btrim(p_q) as t, lower(btrim(p_q)) as tl)
select r.kind, r.slug, r.film_slug, r.title, r.sub, r.poster, r.year, r.score, r.is_catalog from (

  -- films — title, original_title, director
  select 'film'::text as kind, f.slug, null::text as film_slug, f.title,
         trim(both ' ·' from coalesce(f.year::text,'')
           || case when f.director is not null and f.director <> '' then ' · '||f.director else '' end) as sub,
         f.poster_path as poster, f.year,
         (greatest(
            (lower(f.title) = (select tl from q))::int::real,
            case when lower(f.title) like (select tl from q)||'%' then 0.92 else 0 end,
            case when position((select tl from q) in lower(f.title)) > 0 then 0.72 else 0 end,
            similarity(f.title, (select t from q)),
            0.92 * greatest(
              (lower(coalesce(f.original_title,'')) = (select tl from q))::int::real,
              case when lower(coalesce(f.original_title,'')) like (select tl from q)||'%' then 0.9 else 0 end,
              case when position((select tl from q) in lower(coalesce(f.original_title,''))) > 0 then 0.7 else 0 end,
              similarity(coalesce(f.original_title,''), (select t from q))),
            0.55 * similarity(coalesce(f.director,''), (select t from q))
          ) * case when f.visible then 1.0 else 0.8 end)::real as score,
         (not f.visible) as is_catalog
  from films f
  where (f.visible or f.slug not like 'tmdb-%')
    and (f.title % (select t from q) or f.title ilike '%'||(select t from q)||'%'
         or coalesce(f.original_title,'') % (select t from q)
         or f.original_title ilike '%'||(select t from q)||'%'
         or f.director ilike '%'||(select t from q)||'%')

  union all
  -- directors
  select 'director', d.slug, null, d.name, coalesce(d.place_of_birth,''), d.profile_path, null,
         greatest(
           (lower(d.name) = (select tl from q))::int::real,
           case when lower(d.name) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(d.name, (select t from q)))::real,
         false
  from directors d
  where (d.name % (select t from q) or d.name ilike '%'||(select t from q)||'%')
    and exists (select 1 from films f where f.director_slug = d.slug)

  union all
  -- tropes
  select 'trope', m.slug, null, m.title, coalesce(m.laconic,''), null, null,
         greatest(
           (lower(m.title) = (select tl from q))::int::real,
           case when lower(m.title) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(m.title, (select t from q)),
           0.6 * similarity(coalesce(m.laconic,''), (select t from q)))::real,
         false
  from meta_takes m
  where m.status='published' and m.kind='figure_type' and m.slug is not null
    and (m.title % (select t from q) or m.title ilike '%'||(select t from q)||'%'
         or coalesce(m.laconic,'') ilike '%'||(select t from q)||'%')

  union all
  -- readings (published takes)
  select 'reading', fg.slug, fl.slug, t.take_title, fl.title, fl.poster_path, fl.year,
         greatest(
           case when lower(t.take_title) like (select tl from q)||'%' then 0.85 else 0 end,
           similarity(t.take_title, (select t from q)))::real,
         false
  from takes t
  join figures fg on fg.id = t.figure_id and fg.status='approved'
  join films fl on fl.id = fg.film_id and fl.visible
  where t.status='published' and t.framework <> 'INVITATION' and t.take_title is not null
    and (t.take_title % (select t from q) or t.take_title ilike '%'||(select t from q)||'%')

  union all
  -- figures
  select 'figure', fg.slug, fl.slug, fg.label, fl.title, fl.poster_path, fl.year,
         greatest(
           case when lower(fg.label) like (select tl from q)||'%' then 0.85 else 0 end,
           similarity(fg.label, (select t from q)))::real,
         false
  from figures fg join films fl on fl.id = fg.film_id
  where fl.visible and fg.slug is not null
    and (fg.label % (select t from q) or fg.label ilike '%'||(select t from q)||'%')

  union all
  -- theorists
  select 'theorist', th.slug, null, th.name, coalesce(left(th.blurb, 90),''), null, null,
         greatest(
           (lower(th.name) = (select tl from q))::int::real,
           case when lower(th.name) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(th.name, (select t from q)))::real,
         false
  from theorists th
  where th.slug is not null
    and (th.name % (select t from q) or th.name ilike '%'||(select t from q)||'%')

  union all
  -- ideas / concepts (canonical sm_concepts)
  select 'idea', c.cslug, null, c.cname, 'concept', null, null,
         greatest(
           (lower(c.cname) = (select tl from q))::int::real,
           case when lower(c.cname) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(c.cname, (select t from q)))::real,
         false
  from (select distinct coalesce(canon_slug, slug) as cslug, coalesce(canon_name, name) as cname
        from sm_concepts where coalesce(canon_slug, slug) is not null) c
  where (c.cname % (select t from q) or c.cname ilike '%'||(select t from q)||'%')

  union all
  -- traditions (theory canon, deduped by slug)
  select 'tradition', tc.slug, null, tc.title, coalesce(tc.theorist,''), null, null,
         greatest(
           (lower(tc.title) = (select tl from q))::int::real,
           case when lower(tc.title) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(tc.title, (select t from q)),
           0.6 * similarity(coalesce(tc.theorist,''), (select t from q)))::real,
         false
  from (select distinct on (slug) slug, title, theorist from theory_canon where slug is not null) tc
  where (tc.title % (select t from q) or tc.title ilike '%'||(select t from q)||'%'
         or coalesce(tc.theorist,'') ilike '%'||(select t from q)||'%')

  union all
  -- lineage lists (awards / canons / polls)
  select 'lineage', ll.slug, null, ll.label,
         initcap(coalesce(ll.facet,'list'))||' · '||ll.film_count||' films', null, null,
         greatest(
           (lower(ll.label) = (select tl from q))::int::real,
           case when lower(ll.label) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(ll.label, (select t from q)))::real,
         false
  from lineage_lists ll
  where ll.status = 'active' and ll.film_count > 0 and ll.slug is not null
    and (ll.label % (select t from q) or ll.label ilike '%'||(select t from q)||'%')

  union all
  -- movements / national cinemas
  select 'movement', h.hub_slug, null, h.label,
         case when h.hub_type='movement' then 'movement' else 'national cinema' end
           || coalesce(' · '||nullif(h.region,''),''), null, null,
         greatest(
           (lower(h.label) = (select tl from q))::int::real,
           case when lower(h.label) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(h.label, (select t from q)))::real,
         false
  from curation.hub h
  where h.status='live' and h.hub_slug is not null
    and (h.label % (select t from q) or h.label ilike '%'||(select t from q)||'%')

  union all
  -- archetypes (film_slug carries the taxonomy kind for URL mapping)
  select 'archetype', tn.slug, tn.kind, tn.label, 'archetype', null, null,
         greatest(
           (lower(tn.label) = (select tl from q))::int::real,
           case when lower(tn.label) like (select tl from q)||'%' then 0.88 else 0 end,
           similarity(tn.label, (select t from q)))::real,
         false
  from taxonomy_nodes tn
  where tn.status='active' and tn.slug is not null
    and (tn.label % (select t from q) or tn.label ilike '%'||(select t from q)||'%')

) r
where (select length(t) from q) >= 2 and r.score > 0.12
order by r.score desc, r.is_catalog asc, r.title
limit greatest(1, least(p_limit, 120));
$$;

-- ---------------------------------------------------------------------------
-- search_semantic — embedding legs (query vector computed in the API layer)
-- ---------------------------------------------------------------------------
drop function if exists public.search_semantic(text, integer);
create function public.search_semantic(p_qvec text, p_limit integer default 40)
returns table(kind text, slug text, film_slug text, title text, sub text, poster text, year integer, score real, is_catalog boolean)
language sql stable security definer
set search_path to 'public'
set statement_timeout to '8s'
-- (ivfflat.probes / hnsw.ef_search cannot be SET here on Supabase — permission
--  denied for non-superuser. Defaults apply; recall is fine once takes is on HNSW.)
as $$
with v as (select p_qvec::vector(1536) as vec)
select r.kind, r.slug, r.film_slug, r.title, r.sub, r.poster, r.year, r.score, r.is_catalog from (
  (
    select 'reading'::text as kind, fg.slug, fl.slug as film_slug, t.take_title as title,
           fl.title as sub, fl.poster_path as poster, fl.year,
           (1 - (t.embedding <=> (select vec from v)))::real as score, false as is_catalog
    from takes t
    join figures fg on fg.id = t.figure_id and fg.status='approved'
    join films fl on fl.id = fg.film_id and fl.visible
    where t.status='published' and t.framework <> 'INVITATION'
      and t.take_title is not null and t.embedding is not null
    order by t.embedding <=> (select vec from v)
    limit 14
  )
  union all
  (
    select 'trope', m.slug, null, m.title, coalesce(m.laconic,''), null, null,
           (1 - (m.embedding <=> (select vec from v)))::real, false
    from meta_takes m
    where m.status='published' and m.kind='figure_type' and m.slug is not null and m.embedding is not null
    order by m.embedding <=> (select vec from v)
    limit 8
  )
  union all
  (
    select 'film', f.slug, null, f.title,
           trim(both ' ·' from coalesce(f.year::text,'')
             || case when f.director is not null and f.director <> '' then ' · '||f.director else '' end),
           f.poster_path, f.year,
           (1 - (ftv.embedding <=> (select vec from v)))::real, (not f.visible)
    from film_taste_vector ftv join films f on f.id = ftv.film_id
    order by ftv.embedding <=> (select vec from v)
    limit 8
  )
  union all
  (
    select 'director', d.slug, null, d.name, coalesce(d.place_of_birth,''), d.profile_path, null,
           (1 - (de.embedding <=> (select vec from v)))::real, false
    from director_embedding de join directors d on d.slug = de.slug
    order by de.embedding <=> (select vec from v)
    limit 6
  )
  union all
  (
    select 'tradition', x.slug, null, x.title, coalesce(x.theorist,''), null, null, x.score, false
    from (
      select distinct on (tc.slug) tc.slug, tc.title, tc.theorist, tc.score
      from (
        select slug, title, theorist, (1 - (embedding <=> (select vec from v)))::real as score
        from theory_canon
        where slug is not null and embedding is not null
        order by embedding <=> (select vec from v)
        limit 12
      ) tc
      order by tc.slug, tc.score desc
    ) x
    order by x.score desc
    limit 6
  )
  union all
  (
    select 'archetype', tn.slug, tn.kind, tn.label, 'archetype', null, null,
           (1 - (tn.embedding <=> (select vec from v)))::real, false
    from taxonomy_nodes tn
    where tn.status='active' and tn.slug is not null and tn.embedding is not null
    order by tn.embedding <=> (select vec from v)
    limit 6
  )
) r
where r.score > 0.15
order by r.score desc
limit greatest(1, least(p_limit, 60));
$$;

-- ---------------------------------------------------------------------------
-- film_search v2 — original_title + Tier-2 catalog rows
-- (return type changes: drop first; callers read named JSON fields, so the
-- added is_catalog column is backward compatible)
-- ---------------------------------------------------------------------------
drop function if exists public.film_search(text, integer);
create function public.film_search(p_q text, p_limit integer default 8)
returns table(slug text, title text, year integer, poster_path text, director text, is_catalog boolean)
language sql stable security definer
set search_path to 'public'
as $$
  select f.slug, f.title, f.year, f.poster_path, f.director, (not f.visible) as is_catalog
  from films f
  where (f.visible or f.slug not like 'tmdb-%')
    and p_q is not null and length(btrim(p_q)) >= 1
    and (f.title ilike '%'||p_q||'%' or f.original_title ilike '%'||p_q||'%')
  order by (f.title ilike p_q||'%') desc, f.visible desc,
           similarity(f.title, p_q) desc, f.title
  limit greatest(p_limit, 1);
$$;
