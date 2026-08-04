-- 0126 — figure_neighbors: let the HNSW index do the work.
--
-- APPLIED 2026-08-04 (supabase_migrations: figure_neighbors_use_hnsw, then
-- figure_neighbors_ef_tuned — this file is the final state).
--
-- Measured before: 4,063 calls at 948 ms average = 14% of all database time, and
-- 112,255 shared buffers touched PER CALL (~877 MB) on a box with 512 MB of
-- shared_buffers. The largest single source of cache pressure in the database.
--
-- CAUSE. The probe vector arrived as a JOINED COLUMN, not a parameter:
--     from (select embedding from figures where id=p_figure) b, figures f ...
--     order by f.embedding <=> b.embedding
-- An HNSW index scan needs the probe fixed before the scan starts, so
-- `<=> b.embedding` (a column of another relation) disqualifies it. The plan
-- fell back to computing cosine distance across all 18,168 figures — which is
-- also why idx_figures_embedding_hnsw showed ZERO scans and briefly looked like
-- a dead index worth dropping. It was not dead; it was unreachable.
--
-- FIX. Read the vector into a plpgsql variable so the ORDER BY probes a
-- constant, and move the similarity floor OUTSIDE the top-K so it filters a
-- small candidate set instead of fighting the index scan.
--
--     old (exhaustive): 223 ms, 112,255 buffers
--     new:               43 ms,  10,643 buffers
--
-- RECALL. The old implementation was exhaustive, therefore exact; HNSW is
-- approximate, so this rewrite could silently drop neighbours — and the first
-- cut did. With ef_search=100 against a 96-row candidate request it lost a true
-- neighbour (sim 0.509 against a 0.5 floor) on a 40-figure sample. ef barely
-- above k is the classic pgvector recall trap. Sweep on that figure:
--     ef=100 -> 5 rows   ef=200 -> 5   ef=400 -> 5   ef=800 -> 6 (correct)
-- The graph needs an unusually high ef because `figures` contains large clusters
-- of IDENTICAL embeddings — boilerplate labels like "The film as a whole" repeat
-- across films — and duplicate vectors wreck HNSW connectivity.
--
-- VERIFIED against the exhaustive answer over a 40-figure sample at the app's
-- real parameters (p_k=12, p_min=0.5): 352 rows before, 352 after, and the
-- similarity profile is identical for all 40. Where the returned figures differ
-- it is only ever WHICH member of an exact-tie group was picked.
--
-- set_config(..., true) is SET LOCAL. It is used because
-- `ALTER FUNCTION ... SET hnsw.ef_search` is refused on Supabase (42501) — the
-- note left unresolved in migration 0118.
--
-- x.id closes the ORDER BY: sim alone is not a total order, and a ranked
-- function with a LIMIT must not depend on scan order (same class as 0125).

create or replace function public.figure_neighbors(p_figure uuid, p_k integer default 12, p_min double precision default 0.45)
returns table(id uuid, label text, film text, sim double precision)
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v vector;
  cand integer := greatest(coalesce(p_k, 12) * 4, 40);
begin
  select f.embedding into v from public.figures f where f.id = p_figure;
  if v is null then
    return;
  end if;

  -- ef must be MUCH larger than the candidate count, not merely equal to it.
  perform set_config('hnsw.ef_search', greatest(cand * 16, 800)::text, true);

  return query
  select x.id, x.label, fl.title, x.sim
  from (
    select f.id, f.label, f.film_id, (1 - (f.embedding <=> v))::double precision as sim
    from public.figures f
    where f.id <> p_figure
      and f.embedding is not null
      and f.status = 'approved'
    order by f.embedding <=> v
    limit cand
  ) x
  join public.films fl on fl.id = x.film_id
  where x.sim >= p_min
  order by x.sim desc, x.id
  limit greatest(coalesce(p_k, 12), 1);
end
$function$;

-- ⚠️ DATA-QUALITY NOTE, not fixed here. Many figures share a byte-identical
-- embedding because their label is boilerplate ("The film as a whole"). For
-- those, "related figures" is a list of arbitrary films at sim = 1.0000 and
-- means nothing. Worth deciding whether such figures should be excluded from
-- neighbour surfaces entirely.
