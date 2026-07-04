-- Counterpoint edges (Phase 2, connections overhaul, 2026-07-04).
-- Applied as migrations: entity_edges_ledger + film_counterpoints_rpc.
--
-- Definition: two films that share a published trope (figure_type) whose mean
-- reading vectors ON that trope are maximally distant — "same shape, opposite
-- meaning". The only edge type a theory database can produce; similarity sites can't.
--
--   conn_film_trope_vec(film_id, trope_id, v, n)
--     = avg(takes.embedding) per (visible film × published trope), published takes.
--   candidate pairs: share a trope AND reading sim <= 0.45
--     (empirical: pair-trope sim p10=0.42, p25=0.48, median=0.54 on 52k pair-tropes)
--   per unordered pair keep the single most divergent shared trope;
--   score = (1 - sim) * ln(1 + N/df)  (rare tropes weigh more);
--   per film keep top-8, mirrored both directions in entity_edges kind='counterpoint',
--   components = {trope_id, sim}.
--
-- Rebuild (idempotent, run after trope/take changes; ~seconds):
--
--   TRUNCATE conn_film_trope_vec;
--   INSERT INTO conn_film_trope_vec
--   SELECT g.film_id, t.trope_id, avg(t.embedding)::vector(1536), count(*)
--   FROM takes t
--   JOIN figures g ON g.id = t.figure_id
--   JOIN films f ON f.id = g.film_id AND f.visible
--   JOIN meta_takes m ON m.id = t.trope_id AND m.kind='figure_type' AND m.status='published'
--   WHERE t.status='published' AND t.embedding IS NOT NULL
--   GROUP BY g.film_id, t.trope_id;
--
--   BEGIN;
--   DELETE FROM entity_edges WHERE kind='counterpoint';
--   WITH nn AS (SELECT count(DISTINCT film_id)::float AS n FROM conn_film_trope_vec),
--   df AS (SELECT trope_id, count(*) AS c FROM conn_film_trope_vec GROUP BY 1),
--   p AS (
--     SELECT a.film_id AS fa, b.film_id AS fb, a.trope_id, (1-(a.v <=> b.v))::real AS sim
--     FROM conn_film_trope_vec a
--     JOIN conn_film_trope_vec b ON b.trope_id = a.trope_id AND b.film_id > a.film_id
--     WHERE (1-(a.v <=> b.v)) <= 0.45
--   ),
--   best AS (SELECT DISTINCT ON (fa, fb) fa, fb, trope_id, sim FROM p ORDER BY fa, fb, sim ASC),
--   scored AS (SELECT best.*, ((1-best.sim) * ln(1 + (SELECT n FROM nn)/df.c))::real AS score
--              FROM best JOIN df ON df.trope_id = best.trope_id),
--   dir AS (SELECT fa AS s, fb AS d, trope_id, sim, score FROM scored
--           UNION ALL SELECT fb, fa, trope_id, sim, score FROM scored),
--   top AS (SELECT *, row_number() OVER (PARTITION BY s ORDER BY score DESC, d) AS rn FROM dir)
--   INSERT INTO entity_edges (src_type, src_id, dst_type, dst_id, kind, score, components)
--   SELECT 'film', s, 'film', d, 'counterpoint', score,
--          jsonb_build_object('trope_id', trope_id, 'sim', round(sim::numeric,3))
--   FROM top WHERE rn <= 8;
--   COMMIT;

create or replace function public.film_counterpoints(p_slug text, p_n integer default 6)
returns jsonb
language sql stable security definer
set search_path to 'public'
as $$
  with cf as (select id, slug from films where slug = p_slug),
  e as (
    select ee.dst_id, ee.score,
           (ee.components->>'trope_id')::uuid as trope_id,
           (ee.components->>'sim')::float as sim
    from entity_edges ee
    where ee.kind='counterpoint' and ee.src_type='film' and ee.src_id=(select id from cf)
    order by ee.score desc
    limit greatest(p_n, 1)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'film', jsonb_build_object('slug', f.slug, 'title', f.title, 'year', f.year, 'director', f.director),
    'trope', jsonb_build_object('slug', m.slug, 'title', m.title),
    'sim', e.sim,
    'here', (select jsonb_build_object('take', t.take_title, 'figure', g.slug, 'figureLabel', g.label)
             from takes t join figures g on g.id = t.figure_id
             where g.film_id = (select id from cf) and t.trope_id = e.trope_id and t.status='published'
             order by t.strength desc nulls last, t.id limit 1),
    'there', (select jsonb_build_object('take', t.take_title, 'figure', g.slug, 'figureLabel', g.label)
              from takes t join figures g on g.id = t.figure_id
              where g.film_id = e.dst_id and t.trope_id = e.trope_id and t.status='published'
              order by t.strength desc nulls last, t.id limit 1)
  ) order by e.score desc), '[]'::jsonb)
  from e
  join films f on f.id = e.dst_id and f.visible
  join meta_takes m on m.id = e.trope_id;
$$;
grant execute on function public.film_counterpoints(text, integer) to anon, authenticated, service_role;
