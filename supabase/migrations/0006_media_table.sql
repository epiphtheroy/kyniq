-- ============================================================
-- Migration 0006 — Media table (Kyniqbot / Loop 3)
--
-- Stores TMDB images + YouTube videos attached to questions.
-- RLS: public read only where status='published';
-- NOT client-writable (service role / curator writes only).
-- ============================================================

-- Drop old version if it exists (may lack new columns)
DROP TABLE IF EXISTS public.media CASCADE;

CREATE TABLE IF NOT EXISTS public.media (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type   text NOT NULL CHECK (entity_type IN ('question','film','contribution')),
  entity_id     uuid NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('image','video')),
  source        text NOT NULL CHECK (source IN ('tmdb','youtube')),
  external_id   text NOT NULL,
  url           text NOT NULL,
  thumbnail_url text,
  title         text,
  description   text,
  attribution   text NOT NULL DEFAULT '',
  channel_name  text,
  duration      text,
  position      int NOT NULL DEFAULT 0,
  added_by      text NOT NULL DEFAULT 'ai' CHECK (added_by IN ('ai','admin','user')),
  confidence    numeric(3,2) NOT NULL DEFAULT 1.0,
  status        text NOT NULL DEFAULT 'published'
                CHECK (status IN ('draft','published','hidden')),
  spoiler_flagged boolean NOT NULL DEFAULT false,
  meta          jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT media_unique_entity_external UNIQUE (entity_type, entity_id, source, external_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_media_entity
  ON public.media (entity_type, entity_id, position)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_media_source
  ON public.media (source, kind);

-- RLS: public read only where status='published'
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Anon/authenticated can only read published media
CREATE POLICY "Published media is publicly readable"
  ON public.media FOR SELECT
  USING (status = 'published');

-- No INSERT/UPDATE/DELETE for anon/authenticated clients
-- Media is written by service role (curator) and admin only

-- Admin can do everything
CREATE POLICY "Admin full access on media"
  ON public.media FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add 'media_hidden' and 'media_removed' event types
ALTER TABLE public.content_events DROP CONSTRAINT IF EXISTS content_events_event_check;
ALTER TABLE public.content_events ADD CONSTRAINT content_events_event_check
  CHECK (event IN ('generated','verified','approved','scheduled','published','edited',
                   'rejected','hidden','flag_resolved','media_curated',
                   'media_hidden','media_removed'));
