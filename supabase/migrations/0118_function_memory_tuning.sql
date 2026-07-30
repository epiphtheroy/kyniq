-- 0118 — per-function memory/IO tuning: stop the Disk IO Budget bleed.
--
-- Background (measured 2026-07-31, after two Supabase outages and a "Disk IO
-- Budget depleting" email):
--   - Instance work_mem is 5MB. cinecodex_card spills ~11.5MB of temp files
--     PER CALL (EXPLAIN: temp written=1477 blocks; pg_stat_statements: 17 calls
--     → 196MB, the single largest temp writer). It runs on every film view.
--   - search_semantic fans out over six HNSW indexes per call; one cold call
--     read 7,590 blocks (~59MB) from disk. At hnsw.ef_search's default (40),
--     each leg does deep random-IO graph walks — the exact pattern that burns
--     Disk IO Budget. It is a typeahead: ef 24 trades imperceptible recall for
--     roughly half the graph traversal.
--   - Cache hit ratio is 99.89%, so ordinary reads are NOT the problem; sorts
--     and index walks are.
--
-- Why per-function SET and not a global bump: global work_mem multiplies by
-- every concurrent sort in every connection (a saturation foot-gun on a small
-- instance). Scoping to the four functions that measurably spill bounds the
-- extra memory to exactly the queries that need it. All statements are
-- reversible with ALTER FUNCTION ... RESET.

-- The film card: heaviest spiller, hot path (app film brief + web).
alter function public.cinecodex_card(text) set work_mem = '64MB';

-- Unified search, lexical leg: trigram + rank over every entity type.
alter function public.search_all(text, integer) set work_mem = '32MB';

-- Unified search, semantic leg: six HNSW probes per call.
alter function public.search_semantic(text, integer) set work_mem = '32MB';
alter function public.search_semantic(text, integer) set hnsw.ef_search = '24';

-- Secondary temp writers from the same measurement window.
alter function public.wtw_services(text, integer) set work_mem = '16MB';
alter function public.country_geo(text) set work_mem = '16MB';
