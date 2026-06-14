-- ============================================================
-- Migration 0013 — Meta Take spine
-- The figure → take → meta take graph + theory family/theorist
-- attribution + rankings/edges/affinities + token slug history.
-- See: meta-take-architecture.md (authoritative).
-- frame layer is DEPRECATED (kept for seed mining; not dropped here).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ── theory family (index axis) + theorist (attribution) ───────
CREATE TABLE IF NOT EXISTS public.theory_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  blurb text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.theorists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  blurb text,
  created_at timestamptz DEFAULT now()
);

-- ── meta_takes — the hub entity (TV Tropes "trope") ───────────
CREATE TABLE IF NOT EXISTS public.meta_takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,                 -- noun phrase
  laconic text,                        -- one-line
  thesis text,                         -- 2-3 sentences
  essay text,                          -- {{...}} tokens
  theory_family_id uuid REFERENCES public.theory_families(id),
  theorist_id uuid REFERENCES public.theorists(id),
  genres text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'candidate'
        CHECK (status IN ('candidate','approved','published','split','retired')),
  merged_into uuid REFERENCES public.meta_takes(id),
  critic_approved_by text,
  embedding vector(1536),
  raw_concept text,                    -- provenance: seed Theory Concept
  source text DEFAULT 'ai',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_takes_status ON public.meta_takes(status);
CREATE INDEX IF NOT EXISTS idx_meta_takes_family ON public.meta_takes(theory_family_id);

CREATE TABLE IF NOT EXISTS public.meta_take_aliases (
  alias text PRIMARY KEY,
  meta_take_id uuid NOT NULL REFERENCES public.meta_takes(id) ON DELETE CASCADE
);

-- ── figures — concrete elements of a film (Target Object) ─────
CREATE TABLE IF NOT EXISTS public.figures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  film_id uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  kind text CHECK (kind IN ('character','object','location','trope','form')),
  label text NOT NULL,                 -- = Target Object
  description text,                    -- short, purposeful, {{...}} tokens
  spoiler_level text CHECK (spoiler_level IN ('none','mild','major')),
  character_names text,
  image_query text,                    -- seed Image Search Query (matcher input)
  youtube_query text,                  -- seed YouTube Search Keyword (matcher input)
  embedding vector(1536),
  status text NOT NULL DEFAULT 'approved',
  source text DEFAULT 'ai',
  generated_by text,
  self_confidence numeric(4,2),
  claims_sourced boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_figures_film ON public.figures(film_id);

-- ── takes — figure ↔ meta take edge (the 밝힘) ────────────────
CREATE TABLE IF NOT EXISTS public.takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  figure_id uuid NOT NULL REFERENCES public.figures(id) ON DELETE CASCADE,
  meta_take_id uuid REFERENCES public.meta_takes(id) ON DELETE SET NULL,
  rationale text,                      -- cleaned-up reading, {{...}} tokens
  rationale_guide text,                -- simplified (seed Application_Guide)
  confidence numeric(4,2),
  embedding vector(1536),              -- embed the rationale
  -- attribution / provenance (UNPUBLISHED until Crossref-verified)
  raw_concept text,                    -- seed Theory Concept (pre-consolidation)
  source_citation text,               -- seed Source (Chicago) — not published yet
  source_url text,                    -- seed DOI/URL — not published yet
  source_year int,
  theorist_id uuid REFERENCES public.theorists(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_takes_figure ON public.takes(figure_id);
CREATE INDEX IF NOT EXISTS idx_takes_meta_take ON public.takes(meta_take_id);

-- ── post-work: dual ranking, edges, recommendations ──────────
CREATE TABLE IF NOT EXISTS public.meta_take_rankings (
  meta_take_id uuid NOT NULL REFERENCES public.meta_takes(id) ON DELETE CASCADE,
  figure_id uuid NOT NULL REFERENCES public.figures(id) ON DELETE CASCADE,
  relevance numeric,                   -- cosine(take, meta_take): prototypicality
  surprise numeric,                    -- surface distance × confidence gate
  rel_rank int,
  surp_rank int,
  model text,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (meta_take_id, figure_id)
);

CREATE TABLE IF NOT EXISTS public.meta_take_edges (
  a uuid NOT NULL REFERENCES public.meta_takes(id) ON DELETE CASCADE,
  b uuid NOT NULL REFERENCES public.meta_takes(id) ON DELETE CASCADE,
  relation text CHECK (relation IN ('compare','contrast','broader','narrower')),
  similarity numeric,
  PRIMARY KEY (a, b)
);

CREATE TABLE IF NOT EXISTS public.film_affinities (
  film_id uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  related_film_id uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  score numeric,                       -- TF-IDF weighted shared-meta-take sum
  shared_meta_take_ids uuid[],         -- recommendation reason (explainable)
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (film_id, related_film_id)
);

-- ── token / slug machinery (link integrity) ──────────────────
CREATE TABLE IF NOT EXISTS public.slug_history (
  old_slug text NOT NULL,
  entity text NOT NULL CHECK (entity IN ('meta_take','film','director')),
  entity_id uuid NOT NULL,
  changed_at timestamptz DEFAULT now(),
  PRIMARY KEY (old_slug, entity)
);

-- ── hub-gate count view (publish gate: ≥5 distinct films) ─────
CREATE OR REPLACE VIEW public.meta_take_film_counts AS
  SELECT t.meta_take_id, count(DISTINCT f.film_id)::int AS film_count
  FROM public.takes t
  JOIN public.figures f ON f.id = t.figure_id
  WHERE t.meta_take_id IS NOT NULL
  GROUP BY t.meta_take_id;

-- ── RLS (conventions per 0001_init) ──────────────────────────
ALTER TABLE public.theory_families   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theorists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_takes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_take_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.figures           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.takes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_take_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_take_edges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.film_affinities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slug_history      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "theory_families: read" ON public.theory_families FOR SELECT USING (true);
CREATE POLICY "theorists: read" ON public.theorists FOR SELECT USING (true);
CREATE POLICY "meta_takes: read published" ON public.meta_takes
  FOR SELECT USING (status = 'published' OR public.is_admin());
CREATE POLICY "meta_take_aliases: read" ON public.meta_take_aliases FOR SELECT USING (true);
CREATE POLICY "figures: read" ON public.figures
  FOR SELECT USING (status = 'approved' OR public.is_admin());
CREATE POLICY "takes: read" ON public.takes FOR SELECT USING (true);
CREATE POLICY "meta_take_rankings: read" ON public.meta_take_rankings FOR SELECT USING (true);
CREATE POLICY "meta_take_edges: read" ON public.meta_take_edges FOR SELECT USING (true);
CREATE POLICY "film_affinities: read" ON public.film_affinities FOR SELECT USING (true);
CREATE POLICY "slug_history: read" ON public.slug_history FOR SELECT USING (true);

-- frame layer (0011) intentionally NOT dropped: mine for seed first.
