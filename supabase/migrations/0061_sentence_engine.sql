-- 0061: Sentence Engine mass production (applied to prod 2026-07-11 via MCP apply_migration "sentence_engine_tables")
-- Entity-linked rule-based sentences (LLM-0) + kin index + reusable fanout stats.
-- Canonical docs: sentence-engine/README.md (+ MASS-PRODUCTION.md for fill SQL & runbook)

create table if not exists public.sentence_node_stats (
  meta_take_id uuid primary key references public.meta_takes(id) on delete cascade,
  film_count integer not null,
  computed_at timestamptz not null default now()
);

create table if not exists public.sentence_concept_stats (
  theorist_name text not null,
  concept text not null,
  film_count integer not null,
  earliest_film_id uuid references public.films(id) on delete set null,
  earliest_year integer,
  computed_at timestamptz not null default now(),
  primary key (theorist_name, concept)
);

-- kin index: deterministic pair kinship (cos 40 + tfidf 25 + shared-node rarity 35 = 0..100),
-- fills the role of the dead film_affinities.score
create table if not exists public.film_kinship (
  film_id uuid not null references public.films(id) on delete cascade,
  related_film_id uuid not null references public.films(id) on delete cascade,
  kin numeric(6,1) not null,
  cos real,
  tfidf real,
  shared_count integer not null,
  rarity_sum numeric(8,2) not null,
  year_gap integer,
  top_node_id uuid references public.meta_takes(id) on delete set null,
  computed_at timestamptz not null default now(),
  primary key (film_id, related_film_id)
);
create index if not exists film_kinship_kin_idx on public.film_kinship (film_id, kin desc);

create table if not exists public.film_sentences (
  id bigint generated always as identity primary key,
  film_id uuid not null references public.films(id) on delete cascade,
  pattern text not null,
  sentence text not null,
  other_film_id uuid references public.films(id) on delete cascade,
  meta_take_ids uuid[],
  figure_id uuid references public.figures(id) on delete cascade,
  take_id uuid references public.takes(id) on delete cascade,
  theorist_id uuid references public.theorists(id) on delete set null,
  theorist_name text,
  concept text,
  framework text,
  location_id uuid references public.film_locations(id) on delete cascade,
  lineage_list_id uuid references public.lineage_lists(id) on delete cascade,
  lineage_edition_id uuid,
  kin numeric(6,1),
  salience numeric(6,1) not null default 0,
  nums jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists film_sentences_dedupe_idx
  on public.film_sentences (film_id, pattern, md5(sentence));
create index if not exists film_sentences_film_sal_idx on public.film_sentences (film_id, salience desc);
create index if not exists film_sentences_other_idx on public.film_sentences (other_film_id) where other_film_id is not null;
create index if not exists film_sentences_pattern_idx on public.film_sentences (pattern);

alter table public.sentence_node_stats enable row level security;
alter table public.sentence_concept_stats enable row level security;
alter table public.film_kinship enable row level security;
alter table public.film_sentences enable row level security;
create policy "public read" on public.sentence_node_stats for select using (true);
create policy "public read" on public.sentence_concept_stats for select using (true);
create policy "public read" on public.film_kinship for select using (true);
create policy "public read" on public.film_sentences for select using (true);
