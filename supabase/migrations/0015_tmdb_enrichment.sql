-- ============================================================
-- Migration 0015 — TMDB enrichment (media + metadata)
-- Adds curated film metadata columns, a directors (person) table,
-- and extends the existing `media` table to cover director + figure
-- entities. Images/videos themselves live in `media` (reused, not new
-- columns). See MASTER.md / the TMDB enhancement plan.
-- Builds on 0006 (media) + 0013 (figures) + 0014. Idempotent.
-- ============================================================

-- ── films: curated TMDB metadata (images/videos go in `media`) ──
ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS backdrop_path  text,
  ADD COLUMN IF NOT EXISTS tagline        text,
  ADD COLUMN IF NOT EXISTS runtime        int,
  ADD COLUMN IF NOT EXISTS release_date   date,
  ADD COLUMN IF NOT EXISTS certification  text,            -- age rating (from release_dates)
  ADD COLUMN IF NOT EXISTS tmdb_extra     jsonb NOT NULL DEFAULT '{}'::jsonb;
  -- tmdb_extra: { cast:[{name,character}], crew_writer:[], country:[], original_language,
  --              vote_average, collection, status }  — curated, NOT a raw dump.

-- ── directors (person) — keyed by the existing films.director_slug ──
CREATE TABLE IF NOT EXISTS public.directors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,        -- = films.director_slug
  name            text NOT NULL,
  tmdb_person_id  int UNIQUE,
  profile_path    text,                        -- TMDB profile image path
  bio             text,
  birthday        date,
  place_of_birth  text,
  tmdb_extra      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_directors_slug ON public.directors(slug);

-- ── media: allow 'director' and 'figure' entities (reuse the table) ──
ALTER TABLE public.media DROP CONSTRAINT IF EXISTS media_entity_type_check;
ALTER TABLE public.media
  ADD CONSTRAINT media_entity_type_check
  CHECK (entity_type IN ('question','film','contribution','director','figure'));

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.directors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "directors: read" ON public.directors;
CREATE POLICY "directors: read" ON public.directors FOR SELECT USING (true);
-- (media RLS unchanged: anon reads status='published'; service role writes.)
