-- ============================================================
-- Migration 0007 — Pipeline v4 (prompt-design hardening)
--
-- Changes:
--   1. Add 'held' to status check constraints
--   2. Create film_dossiers table (once-per-film cache)
--   3. Add evidence_refs, rubric_scores JSONB to questions
--   4. Add tldr TEXT to canonical_answers
-- ============================================================

-- 1. Update status check constraints to include 'held'
--    Drop and recreate for questions, canonical_answers, contributions

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_status_check;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_status_check
  CHECK (status IN ('draft', 'in_review', 'held', 'approved', 'published', 'hidden', 'rejected'));

ALTER TABLE public.canonical_answers
  DROP CONSTRAINT IF EXISTS canonical_answers_status_check;
ALTER TABLE public.canonical_answers
  ADD CONSTRAINT canonical_answers_status_check
  CHECK (status IN ('draft', 'in_review', 'held', 'approved', 'published', 'hidden', 'rejected'));

ALTER TABLE public.contributions
  DROP CONSTRAINT IF EXISTS contributions_status_check;
ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_status_check
  CHECK (status IN ('draft', 'in_review', 'held', 'approved', 'published', 'hidden', 'rejected'));

-- 2. Film dossiers (cached evidence per film)
CREATE TABLE IF NOT EXISTS public.film_dossiers (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id     uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  dossier     jsonb NOT NULL,        -- full dossier JSON (facts, context, specifics, comparisons, observations, uncertainties)
  model       text NOT NULL,         -- model used to build dossier
  provider    text NOT NULL DEFAULT 'gemini',
  cost_usd    numeric DEFAULT 0,
  tokens_used integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),

  CONSTRAINT film_dossiers_film_unique UNIQUE (film_id)
);

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_film_dossiers_film ON public.film_dossiers(film_id);

-- 3. Add evidence_refs + rubric_scores to questions
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS evidence_refs jsonb DEFAULT NULL;
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS rubric_scores jsonb DEFAULT NULL;

-- 4. Add tldr to canonical_answers
ALTER TABLE public.canonical_answers
  ADD COLUMN IF NOT EXISTS tldr text DEFAULT NULL;
