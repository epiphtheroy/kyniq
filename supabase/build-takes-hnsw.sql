-- ============================================================
-- OPTIONAL speed-up (NOT required to launch). Build the HNSW index on
-- takes.embedding. Vector search already uses the existing IVFFlat index and
-- runs in ~0.8s warm; the full /ask answer is dominated by LLM generation, so
-- this is a refinement, not a blocker. Run it whenever convenient.
--
-- WHY HERE (not a .command/MCP): 46.5k vectors build in ~10-15 min; the MCP
-- connection times out and ROLLS BACK mid-build, and .env.local has no direct
-- Postgres connection string for a psql-based command. The Supabase SQL Editor
-- holds a stable connection, so it completes.
--
-- HOW: Supabase Dashboard (project "kyniq") → SQL Editor → New query →
--      paste ALL of this → Run. Leave the tab open until success (~10-15 min).
--
-- Effect: vector leg ~0.8s → tens of ms. Index only — does NOT re-embed. Safe
-- to re-run (IF NOT EXISTS).
-- ============================================================
set statement_timeout = '0';

create index if not exists idx_takes_embedding_hnsw
  on public.takes using hnsw (embedding vector_cosine_ops);

-- After it finishes, this should return one row with indisvalid = true:
select indexrelid::regclass as index, indisvalid
from pg_index where indexrelid = 'public.idx_takes_embedding_hnsw'::regclass;

-- OPTIONAL (after the HNSW is valid): drop the now-redundant IVFFlat to save disk +
-- speed up writes. Only run this once the line above shows indisvalid = true.
--   drop index if exists idx_takes_emb_ivf;
