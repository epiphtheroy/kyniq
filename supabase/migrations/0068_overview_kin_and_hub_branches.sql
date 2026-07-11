-- 0068: (a) map_film_overview carries kin weight (w) on "like" edges, matching
-- map_film_ego (0063); (b) sentences_for_entity gains 'lineage' and 'genre'
-- branches + lineage_list_id partial index. (Applied to prod 2026-07-11 via MCP
-- "overview_kin_and_hub_branches".)
--
-- ⚠️ map_film_overview has a legacy 0-arg overload — zero-arg SQL calls are
-- ambiguous; the API route always passes the three named p_min_* args, which
-- resolves to this 3-arg version. Don't add another overload.
-- ⚠️ NOT feasible (measured 2026-07-11): 'concept' (takes.concept free text vs
-- theory_concepts registry matches only 8/7,733 distinct values) and 'frame'
-- (frames table = question-frames layer, NOT the 14 SM frameworks; the SM keys
-- live only in lib/frameworks.ts + takes.framework text).
--
-- Genre slug derivation mirrors lib/related.ts slugifyGenre:
--   trim(both '-' from regexp_replace(lower(g), '[^a-z0-9]+', '-', 'g'))
--
-- Full definitions live in the DB (pg_get_functiondef); the authoritative SQL
-- bodies were applied via MCP — see docs/WORKORDER-sentence-surfaces.md Phase 1.8.

create index if not exists film_sentences_lineage_idx
  on public.film_sentences (lineage_list_id) where lineage_list_id is not null;
