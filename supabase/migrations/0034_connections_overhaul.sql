-- ============================================================================
-- 0034 — Connections overhaul (2026-07-04). docs/PLAN-connections-overhaul.md
-- Applied live via MCP as migrations:
--   connections_rebuild_stage, conn_rebuild_rpcs (+ _fix_ambiguous_n),
--   map_ego_deterministic, concept_map_table, concept_map_joins,
--   entity_edges_ledger, film_counterpoints_rpc.
-- This file consolidates them so the repo mirrors the live DB.
-- Long function bodies live in ../rpc/ (canonical copies):
--   ../rpc/conn_rebuild.sql    — staging tables + chunked rebuild RPCs (film_affinities)
--   ../rpc/map_ego.sql         — deterministic ego graph (+ concept_map joins)
--   ../rpc/counterpoints.sql   — entity_edges counterpoint build + film_counterpoints()
-- ============================================================================

-- 1. film_affinities hybrid rebuild (RRF: trope TF-IDF + film_taste_vector KNN)
--    -> see ../rpc/conn_rebuild.sql ; runner: worker/mt-recommend.py

-- 2. map_ego determinism (ORDER BY random() removed) -> ../rpc/map_ego.sql

-- 3. concept_map — canonical concept resolution (exact + embedding >= 0.70)
create table if not exists public.concept_map (
  raw_l text primary key,
  concept_id uuid not null references public.sm_concepts(id) on delete cascade,
  sim real not null,
  method text not null check (method in ('exact','embed')),
  updated_at timestamptz not null default now()
);
alter table public.concept_map enable row level security;
drop policy if exists "concept_map: read" on public.concept_map;
create policy "concept_map: read" on public.concept_map for select using (true);
-- builder: worker/concept-embed.py (report first, then --write <threshold>)

-- 4. Route concept joins through concept_map (applied as migration concept_map_joins).
--    Mechanical rewrite of: map_ego, map_overview, surprise_home, sm_concept_readings,
--    concept_detail, home_v2_bundle. Replacements (idempotent):
--      join sm_concepts c on c.name_l=lower(btrim(t.concept))
--        -> join sm_concepts c on exists (select 1 from public.concept_map k9
--             where k9.raw_l=lower(btrim(t.concept)) and k9.concept_id=c.id)
--      join public.takes t on lower(btrim(t.concept)) = c.name_l
--        -> ... exists (select 1 from public.concept_map k9 ...) ...
--      lower(btrim(t.concept)) in (select name_l from mem)            [concept_detail]
--        -> in (select k9.raw_l from public.concept_map k9
--               join public.sm_concepts s9 on s9.id=k9.concept_id
--               where s9.canon_slug = (select canon_slug from res))
--      join sm_concepts c2 on c2.name_l = lower(btrim(t2.concept))    [concept_detail related]
--        -> exists-form via concept_map k8
--      lower(btrim(t.concept))=sc.name_l                              [home_v2_bundle]
--        -> exists-form via concept_map k9

-- 5. entity_edges — typed ledger for computed connections (counterpoint first)
create table if not exists public.entity_edges (
  src_type text not null,
  src_id uuid not null,
  dst_type text not null,
  dst_id uuid not null,
  kind text not null,
  score real not null,
  components jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (src_type, src_id, kind, dst_type, dst_id)
);
create index if not exists idx_entity_edges_src on public.entity_edges (src_type, src_id, kind, score desc);
alter table public.entity_edges enable row level security;
drop policy if exists "entity_edges: read" on public.entity_edges;
create policy "entity_edges: read" on public.entity_edges for select using (true);

create table if not exists public.conn_film_trope_vec (
  film_id uuid not null,
  trope_id uuid not null,
  v vector(1536) not null,
  n int not null,
  primary key (film_id, trope_id)
);
alter table public.conn_film_trope_vec enable row level security;

-- 6. counterpoint edges + film_counterpoints() read RPC -> ../rpc/counterpoints.sql
