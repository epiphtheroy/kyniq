-- ============================================================
-- Migration 0011 — Frames & Tags layer (site-ia-plan.md §7)
-- The question-archetype (frame) ontology + open-tag vocabulary.
-- Frames: bottom-up extracted, admin-gated; instances classified
-- by the Loop-5 batch. Tags: canonical vocabulary + alias map.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ── frames — question archetypes (~150, admin-gated) ─────────
CREATE TABLE IF NOT EXISTS public.frames (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension   text NOT NULL,           -- ending / symbol-or-motif / …
  slug        text UNIQUE NOT NULL,
  label       text NOT NULL,           -- "Is the ending real or a fantasy?"
  definition  text,
  slot_schema jsonb DEFAULT '[]',      -- [{name, values[]}]
  status      text NOT NULL DEFAULT 'candidate'
              CHECK (status IN ('candidate','approved','merged','retired')),
  merged_into uuid REFERENCES public.frames(id),
  embedding   vector(1536),            -- openai text-embedding-3-small
  source      text DEFAULT 'ai',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── question_frames — instance classification ────────────────
CREATE TABLE IF NOT EXISTS public.question_frames (
  question_id   uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  frame_id      uuid NOT NULL REFERENCES public.frames(id) ON DELETE CASCADE,
  is_primary    boolean NOT NULL DEFAULT true,
  slots         jsonb DEFAULT '{}',
  confidence    numeric(4,2),
  evidence      text,
  classified_by text,                  -- model tag or 'bootstrap'
  created_at    timestamptz DEFAULT now(),
  PRIMARY KEY (question_id, frame_id)
);
CREATE INDEX IF NOT EXISTS idx_question_frames_frame ON public.question_frames(frame_id);

-- ── frame_rankings — materialised editorial ranking per frame ─
CREATE TABLE IF NOT EXISTS public.frame_rankings (
  frame_id    uuid NOT NULL REFERENCES public.frames(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  rank        int NOT NULL,
  rationale   text,
  model       text,
  updated_at  timestamptz DEFAULT now(),
  PRIMARY KEY (frame_id, question_id)
);

-- ── canonical_tags / tag_aliases / question_tags ──────────────
CREATE TABLE IF NOT EXISTS public.canonical_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL CHECK (kind IN ('motif','theme','symbol','technique','context')),
  slug        text UNIQUE NOT NULL,
  label       text NOT NULL,
  description text,
  embedding   vector(1536),
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','merged','retired')),
  merged_into uuid REFERENCES public.canonical_tags(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tag_aliases (
  alias        text PRIMARY KEY,        -- normalised surface form
  canonical_id uuid NOT NULL REFERENCES public.canonical_tags(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.question_tags (
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  tag_id      uuid NOT NULL REFERENCES public.canonical_tags(id) ON DELETE CASCADE,
  confidence  numeric(4,2),
  evidence    text,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (question_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_question_tags_tag ON public.question_tags(tag_id);

-- ── hub-gate counts (IA §6: hubs publish at >=5 instances) ────
CREATE OR REPLACE VIEW public.frame_instance_counts AS
  SELECT qf.frame_id, count(*)::int AS instance_count
  FROM public.question_frames qf
  JOIN public.questions q ON q.id = qf.question_id AND q.status = 'published'
  WHERE qf.is_primary
  GROUP BY qf.frame_id;

-- ── RLS (conventions per 0001_init) ───────────────────────────
ALTER TABLE public.frames         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frame_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_aliases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_tags  ENABLE ROW LEVEL SECURITY;

-- Anon reads only what hub pages may show; workers use service role.
CREATE POLICY "frames: read approved" ON public.frames
  FOR SELECT USING (status = 'approved' OR public.is_admin());
CREATE POLICY "question_frames: read" ON public.question_frames
  FOR SELECT USING (true);
CREATE POLICY "frame_rankings: read" ON public.frame_rankings
  FOR SELECT USING (true);
CREATE POLICY "canonical_tags: read active" ON public.canonical_tags
  FOR SELECT USING (status = 'active' OR public.is_admin());
CREATE POLICY "tag_aliases: read" ON public.tag_aliases
  FOR SELECT USING (true);
CREATE POLICY "question_tags: read" ON public.question_tags
  FOR SELECT USING (true);
