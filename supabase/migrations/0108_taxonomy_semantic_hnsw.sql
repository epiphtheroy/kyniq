-- 0108: taxonomy_nodes embedding HNSW index.
-- search_semantic()'s archetype leg was the only one of its 7 vector scans
-- without an index — Seq Scan over 2,866 × 1536-d rows cost ~830ms per search
-- (measured 2026-07-17 during the DB-saturation incident).
-- Partial predicate mirrors the leg's WHERE clause exactly.
create index if not exists idx_taxonomy_nodes_emb_hnsw
  on public.taxonomy_nodes using hnsw (embedding vector_cosine_ops)
  where status = 'active' and slug is not null and embedding is not null;

analyze public.taxonomy_nodes;
