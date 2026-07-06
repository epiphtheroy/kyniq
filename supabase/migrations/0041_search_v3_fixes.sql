-- 0041_search_v3_fixes.sql — post-review fixes for the unified search (0040)
--
-- 1. search_semantic film leg: exclude tmdb-% stub films (visible=false,
--    slug like 'tmdb-%') the lexical leg already filters out. Latent today
--    (0 stubs carry a taste vector) but the two legs must agree.
-- 2. films.director trigram index: the search_all films branch ORs an
--    unindexable `director ilike` arm, forcing a ~7k-row seq scan per call.
--    With the index the planner can BitmapOr three GIN scans.
-- 3. Explicit grants for the three RPCs (0040 relied on default PUBLIC
--    EXECUTE; the project's earlier search migration (0019) manages function
--    privileges explicitly, so keep that discipline).
-- 4. takes HNSW: built out-of-band (partial index, published+embedded rows
--    only — the full-table build exceeds the instance's maintenance memory):
--      create index idx_takes_pub_emb_hnsw on public.takes
--        using hnsw (embedding vector_cosine_ops)
--        where status='published' and embedding is not null;
--    Recorded here for provenance; CREATE INDEX in a migration would time out.

create index if not exists idx_films_director_trgm on public.films using gin (director gin_trgm_ops);

drop function if exists public.search_semantic(text, integer);
create function public.search_semantic(p_qvec text, p_limit integer default 40)
returns table(kind text, slug text, film_slug text, title text, sub text, poster text, year integer, score real, is_catalog boolean)
language sql stable security definer
set search_path to 'public'
set statement_timeout to '8s'
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
    where (f.visible or f.slug not like 'tmdb-%')  -- match search_all's stub exclusion
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

-- explicit privileges (match 0019's managed-EXEC discipline)
revoke all on function public.search_all(text, integer) from public;
revoke all on function public.search_semantic(text, integer) from public;
revoke all on function public.film_search(text, integer) from public;
grant execute on function public.search_all(text, integer) to anon, authenticated, service_role;
grant execute on function public.search_semantic(text, integer) to anon, authenticated, service_role;
grant execute on function public.film_search(text, integer) to anon, authenticated, service_role;
