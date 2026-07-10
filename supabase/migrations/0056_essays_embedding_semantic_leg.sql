-- 0056 — essays get embeddings; search_semantic learns an essays leg.
--
-- worker/essay-embed.py fills essays.embedding (title+dek+body_md,
-- text-embedding-3-small, ~$0.03 for 1,654 verified EN essays). The semantic
-- RPC then surfaces desk essays for meaning queries; slug column carries the
-- desk key (mode→key CASE mirrors lib/desks.ts).
-- Applied live 2026-07-10 (mcp apply_migration essays_embedding_semantic_leg).

alter table public.essays add column if not exists embedding vector(1536);
create index if not exists idx_essays_embedding_hnsw on public.essays
  using hnsw (embedding vector_cosine_ops)
  where status = 'verified' and lang = 'en' and embedding is not null;

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
    limit 12
  )
  union all
  (
    select 'essay',
           case e.mode when 'fan_theories' then 'theories' when 'concept_briefing' then 'decoder'
             when 'meta_critique' then 'debates' when 'radical_critique' then 'contested'
             when 'reception_meta' then 'reception-story' when 'juxtaposition' then 'parallel-lives'
             when 'the_lens' then 'field-test' else 'exegesis' end,
           f.slug, e.title, f.title, f.poster_path, f.year,
           (1 - (e.embedding <=> (select vec from v)))::real, false
    from essays e join films f on f.id = e.film_id and f.visible
    where e.status='verified' and e.lang='en' and e.embedding is not null
    order by e.embedding <=> (select vec from v)
    limit 8
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

grant execute on function public.search_semantic(text, integer) to anon, authenticated, service_role;
