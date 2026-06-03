-- ============================================================
-- Migration 0004 — Film pipeline tracking fields
-- Adds fields for autonomous daily scheduler (§3.2 Do #1–#2)
-- ============================================================

-- Pipeline tracking columns
ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS in_pipeline      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS questions_target  int         NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS questions_published int      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_status   text       NOT NULL DEFAULT 'idle'
                           CHECK (pipeline_status IN ('idle', 'queued', 'in_progress', 'done'));

-- Index for scheduler: quickly find films needing work
CREATE INDEX IF NOT EXISTS idx_films_pipeline_pending
  ON public.films (pipeline_status, questions_published)
  WHERE in_pipeline = true AND pipeline_status IN ('queued', 'in_progress');

-- Update the existing seed films to be in the pipeline
UPDATE public.films SET in_pipeline = true, pipeline_status = 'queued' WHERE tmdb_id IS NOT NULL;

-- Add daily_films to rate_limits config for the scheduler
UPDATE public.pipeline_config
SET value = value || '{"daily_films": 20}'::jsonb
WHERE key = 'rate_limits';
