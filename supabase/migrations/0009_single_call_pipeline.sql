-- Migration: Single-call pipeline columns
-- Adds provenance fields for the single-call featured Q&A generator.
-- See: prompt-featured-qa.md, mission-pipeline-worker-kickoff.md

-- Questions: add asker_lens + self-gate fields
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS asker_lens text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS self_confidence numeric(4,2);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS claims_sourced boolean;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- Canonical answers: add answerer_lens + aha + self-gate fields
ALTER TABLE public.canonical_answers ADD COLUMN IF NOT EXISTS answerer_lens text;
ALTER TABLE public.canonical_answers ADD COLUMN IF NOT EXISTS aha text;
ALTER TABLE public.canonical_answers ADD COLUMN IF NOT EXISTS self_confidence numeric(4,2);
ALTER TABLE public.canonical_answers ADD COLUMN IF NOT EXISTS claims_sourced boolean;
ALTER TABLE public.canonical_answers ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- Contributions: add scheduled_for for staggered publishing
ALTER TABLE public.contributions ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- Note: question_type column stays in place (nullable, no data loss) but is
-- no longer populated by the pipeline. The CHECK constraints for status
-- already include 'approved' from prior migrations (0005, 0007).
-- in_review is kept in the CHECK constraint for backward compat but
-- the pipeline no longer writes it.
