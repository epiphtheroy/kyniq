-- ============================================================
-- Enhancement Pack — jobs, media, pipeline_config
-- Apply after 0001_init.sql
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

-- 1a. jobs — pipeline job queue (§3.2 worker topology)
CREATE TABLE public.jobs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL    DEFAULT now(),
  updated_at     timestamptz NOT NULL    DEFAULT now(),
  film_id        uuid        NOT NULL    REFERENCES public.films(id) ON DELETE CASCADE,
  question_types text[]      NOT NULL    DEFAULT ARRAY['interpretation','symbolism','character','technique','theme','ending','comparison','context'],
  target_count   int         NOT NULL    DEFAULT 10,
  status         text        NOT NULL    DEFAULT 'queued'
                             CHECK (status IN ('queued','claimed','running','done','failed')),
  claimed_by     text,
  claimed_at     timestamptz,
  params         jsonb       NOT NULL    DEFAULT '{}',
  result         jsonb,
  error          text,
  created_by     uuid        REFERENCES public.profiles(id)
);

-- 1b. media — auto-embedded images & video (§3.3)
CREATE TABLE public.media (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL    DEFAULT now(),
  entity_type    text        NOT NULL    CHECK (entity_type IN ('question','film')),
  entity_id      uuid        NOT NULL,
  kind           text        NOT NULL    CHECK (kind IN ('image','video')),
  source         text        NOT NULL    CHECK (source IN ('tmdb','youtube')),
  external_id    text        NOT NULL,
  url            text        NOT NULL,
  thumbnail_url  text,
  caption        text,
  attribution    text,
  position       int         NOT NULL    DEFAULT 0,
  added_by       text        NOT NULL    DEFAULT 'ai'
                             CHECK (added_by IN ('ai','human')),
  confidence     numeric,
  status         text        NOT NULL    DEFAULT 'published'
                             CHECK (status IN ('draft','published','hidden'))
);

-- 1c. pipeline_config — admin-tunable configuration
CREATE TABLE public.pipeline_config (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key            text        NOT NULL    UNIQUE,
  value          jsonb       NOT NULL    DEFAULT '{}',
  updated_at     timestamptz NOT NULL    DEFAULT now(),
  updated_by     uuid        REFERENCES public.profiles(id)
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX idx_jobs_status         ON public.jobs(status);
CREATE INDEX idx_jobs_film_id        ON public.jobs(film_id);
CREATE INDEX idx_jobs_created_at     ON public.jobs(created_at DESC);

CREATE INDEX idx_media_entity        ON public.media(entity_type, entity_id);
CREATE INDEX idx_media_status        ON public.media(status);
CREATE INDEX idx_media_kind          ON public.media(kind);
CREATE INDEX idx_media_source        ON public.media(source);

CREATE INDEX idx_pipeline_config_key ON public.pipeline_config(key);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_config ENABLE ROW LEVEL SECURITY;

-- ----- jobs: admin-only -----
CREATE POLICY "Admin read jobs"
  ON public.jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin insert jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin update jobs"
  ON public.jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ----- media: public read published only, no client write -----
CREATE POLICY "Anyone can read published media"
  ON public.media FOR SELECT
  USING (status = 'published');

-- No INSERT/UPDATE/DELETE policies for anon/auth —
-- the curator writes via service role only.
-- Admin can update status via service role.

-- ----- pipeline_config: admin-only -----
CREATE POLICY "Admin read config"
  ON public.pipeline_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin update config"
  ON public.pipeline_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- 4. SEED pipeline_config defaults
-- ============================================================

INSERT INTO public.pipeline_config (key, value) VALUES
  ('model_router', '{
    "planner":       { "provider": "gemini", "model": "gemini-2.5-flash" },
    "drafter":       { "provider": "gemini", "model": "gemini-2.5-flash" },
    "verifier":      { "provider": "openai", "model": "gpt-4o-mini" },
    "tone_reviewer": { "provider": "gemini", "model": "gemini-2.5-flash" }
  }'::jsonb),
  ('personas', '[
    {
      "id": "kyniq-editorial",
      "name": "Kyniq Editorial",
      "register": "authoritative-accessible",
      "description": "The default editorial voice. Clear, precise, avoids jargon. Leads with observation, follows with theory. Korean-criticism sensibility with international reach.",
      "system_prompt_suffix": "Write in a clear, authoritative yet accessible tone. Lead with precise scene observation before theory. Prefer productive uncertainty over forced conclusions."
    },
    {
      "id": "seo-yuna",
      "name": "서유나 (Seo Yuna)",
      "register": "formal-critical",
      "description": "A voice rooted in Korean film criticism tradition. Formal, theory-aware, draws on Korean critical vocabulary and East Asian cinematic context.",
      "system_prompt_suffix": "Write with formal critical precision. Draw on Korean and East Asian cinematic traditions. Reference film theory when it illuminates, but never for its own sake."
    },
    {
      "id": "alex-reed",
      "name": "Alex Reed",
      "register": "cinephile-conversational",
      "description": "An engaged cinephile voice. Slightly more conversational, connects films to lived experience and broader culture. Still analytically rigorous.",
      "system_prompt_suffix": "Write with engaged, slightly conversational warmth while maintaining analytical rigor. Connect films to broader cultural context and human experience."
    }
  ]'::jsonb),
  ('rate_limits', '{
    "max_per_run": 10,
    "max_per_day": 50,
    "max_per_film_per_day": 10,
    "cooldown_minutes": 5,
    "ramp_up_days": 7,
    "ramp_up_daily_cap": 20
  }'::jsonb),
  ('gate_threshold', '{ "default": 0.85, "auto_publish_min": 0.90 }'::jsonb),
  ('worker_state', '{ "paused": false }'::jsonb);
