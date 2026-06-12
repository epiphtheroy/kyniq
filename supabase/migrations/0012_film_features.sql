-- ============================================================
-- Migration 0012 — Film features (fixed hub sections)
-- Four fixed sections per film: pitch / record / reception /
-- experience. See film-features-plan.md.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.film_features (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  film_id         uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('pitch','record','reception','experience')),
  body            text,                  -- prose (pitch invitation, reception essay)
  payload         jsonb DEFAULT '{}',    -- structured content per kind
  status          text NOT NULL DEFAULT 'approved'
                  CHECK (status IN ('draft','approved','published','hidden')),
  source          text DEFAULT 'ai',
  generated_by    text,
  self_confidence numeric(4,2),
  claims_sourced  boolean,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (film_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_film_features_film ON public.film_features(film_id);

-- The aesthetic-experience level becomes a first-class classification axis
ALTER TABLE public.films ADD COLUMN IF NOT EXISTS aesthetic_level int
  CHECK (aesthetic_level BETWEEN 1 AND 10);
ALTER TABLE public.films ADD COLUMN IF NOT EXISTS aesthetic_label text;

-- RLS (conventions per 0001_init)
ALTER TABLE public.film_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "film_features: read published" ON public.film_features
  FOR SELECT USING (status = 'published' OR public.is_admin());
