-- ============================================================
-- Migration 0005 — Publisher Loop (cadence engine)
--
-- Adds 'approved' status to the content lifecycle, plus
-- scheduled_for field for independent publish timing with jitter.
--
-- Content flow: draft → in_review → approved (buffer) → published
-- The publisher loop releases approved items on schedule.
-- ============================================================

-- 1. Add 'approved' to status CHECK constraints
-- We must drop and recreate since ALTER CONSTRAINT isn't supported

-- questions
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_status_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_status_check
  CHECK (status IN ('draft','in_review','approved','published','rejected','hidden'));

-- canonical_answers
ALTER TABLE public.canonical_answers DROP CONSTRAINT IF EXISTS canonical_answers_status_check;
ALTER TABLE public.canonical_answers ADD CONSTRAINT canonical_answers_status_check
  CHECK (status IN ('draft','in_review','approved','published','hidden'));

-- contributions
ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_status_check;
ALTER TABLE public.contributions ADD CONSTRAINT contributions_status_check
  CHECK (status IN ('draft','in_review','approved','published','rejected','hidden'));

-- 2. Add scheduled_for field for jittered publish timing
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

ALTER TABLE public.canonical_answers
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- 3. Index for the publisher: find approved items ready to publish
CREATE INDEX IF NOT EXISTS idx_questions_scheduled
  ON public.questions (scheduled_for)
  WHERE status = 'approved' AND scheduled_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_canonical_answers_scheduled
  ON public.canonical_answers (scheduled_for)
  WHERE status = 'approved' AND scheduled_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contributions_scheduled
  ON public.contributions (scheduled_for)
  WHERE status = 'approved' AND scheduled_for IS NOT NULL;

-- 4. Add 'approved' and 'scheduled' event types to content_events
ALTER TABLE public.content_events DROP CONSTRAINT IF EXISTS content_events_event_check;
ALTER TABLE public.content_events ADD CONSTRAINT content_events_event_check
  CHECK (event IN ('generated','verified','approved','scheduled','published','edited',
                   'rejected','hidden','flag_resolved','media_curated'));

-- 5. Publisher config seed
INSERT INTO public.pipeline_config (key, value)
VALUES ('publisher', '{
  "daily_publish_cap": 30,
  "ramp_up_days": 14,
  "ramp_start_cap": 5,
  "jitter_min_minutes": 15,
  "jitter_max_minutes": 120,
  "answer_delay_minutes": 60,
  "contribution_delay_minutes": 180,
  "publish_interval_seconds": 300
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
