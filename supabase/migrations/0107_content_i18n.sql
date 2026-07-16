-- 0107 — content_i18n: the central, multi-language matching table for DB-stored
-- wordings (labels, definitions, category names, invitations, …).
-- 정본: HANDOFF-다국어프로젝션.md (structural-wording layer) + 한국어화-i18n-마스터.md §6.2
--
-- WHY a side table and not `_<loc>` columns per table: dozens of tables carry
-- translatable labels (taxonomy_nodes, theory_concepts, meta_takes, theorists,
-- figures, lineage_lists, frames, …). A `_ko`/`_ja`/`_es` column on each is
-- unmanageable. One keyed side table holds every translation for every language
-- and every table, and adding a language is just more rows.
--
-- SEO SAFETY (owner hard rule): this table is read ONLY when rendering a
-- non-English locale (lib/i18n/dbLabel). English pages never consult it, so the
-- English SEO surface is byte-identical. Additive, nullable, own RLS — zero risk
-- to existing English queries.
--
-- SCOPE: structural wordings + invitations. NOT deep content (take rationales,
-- figure descriptions, essay bodies, reception comments) — those stay English.
--
-- films.title_ko / overview_ko (migration 0105) stay as columns: high-volume,
-- per-row, TMDB-sourced. content_i18n is for everything else.

create table if not exists content_i18n (
  entity_type   text not null,        -- 'taxonomy' | 'concept' | 'trope' | 'theorist' | 'figure' | 'frame' | 'lineage_list' | 'invitation' | 'enum' | ...
  entity_key    text not null,        -- source PK / slug / stable key (for 'enum', the English value itself)
  field         text not null,        -- 'label' | 'definition' | 'one_liner' | 'blurb' | 'name' | 'title' | 'rationale' | ...
  lang          text not null,        -- 'ko' | (future 'ja','fr','es') — never 'en'
  text          text not null,        -- the translation
  source_sha256 text,                 -- sha256 of the English source at translation time (staleness detection; nullable for enum seeds)
  model         text,                 -- e.g. 'claude-fable-5' | 'hand' | 'tmdb'
  updated_at    timestamptz not null default now(),
  primary key (entity_type, entity_key, field, lang)
);

comment on table content_i18n is
  'Multi-language translations of DB-stored structural wordings + invitations. Read ONLY for non-English locales (lib/i18n/dbLabel) so English pages/SEO are untouched. Deep content (rationales, descriptions, essay/reception bodies) is NOT stored here — stays English.';

-- Fast lookup for a whole locale render (grab all translations for a set of keys).
create index if not exists content_i18n_lookup
  on content_i18n (entity_type, lang, entity_key);

-- Public read (anon) — SECURITY: only translations of already-public labels are
-- ever inserted (no private data), and the app reads them anon like films.
alter table content_i18n enable row level security;
drop policy if exists content_i18n_read on content_i18n;
create policy content_i18n_read on content_i18n for select to anon, authenticated using (true);
