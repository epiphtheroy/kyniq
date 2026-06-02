-- ============================================================
-- Mission 1 — Data layer (SPEC §4)
-- Creates all v1 tables, indexes, RLS policies, and the
-- handle_new_user trigger.
--
-- Conventions:
--   • Every table has: id uuid PK default gen_random_uuid(),
--     created_at timestamptz default now()
--   • Lifecycle/provenance fields (§3.2): status, source,
--     generated_by, reviewed_by, published_at
--   • Upvote-only — no downvote column anywhere
--   • No people / mentions tables (Mission 12)
-- ============================================================

-- ============================================================
-- 1. TABLES (in dependency order)
-- ============================================================

-- 1a. films — cached TMDB metadata
CREATE TABLE public.films (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL    DEFAULT now(),
  tmdb_id     int         UNIQUE,
  title       text        NOT NULL,
  original_title text,
  year        int,
  director    text,
  director_slug text,
  poster_path text,
  overview    text,
  slug        text        NOT NULL UNIQUE,
  genres      text[],
  keywords    text[],
  imdb_id     text,
  wikidata_id text
);

-- 1b. profiles — linked to auth.users
CREATE TABLE public.profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  username       text        UNIQUE,
  display_name   text,
  bio            text,
  avatar_url     text,
  reputation     int         NOT NULL DEFAULT 0,
  is_public      boolean     NOT NULL DEFAULT true,
  role           text        NOT NULL DEFAULT 'user'
                             CHECK (role IN ('user', 'admin', 'system')),
  account_status text        NOT NULL DEFAULT 'active'
                             CHECK (account_status IN ('active', 'suspended'))
);

-- 1c. questions — one per film+question, with lifecycle/provenance
CREATE TABLE public.questions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL    DEFAULT now(),
  film_id       uuid        NOT NULL    REFERENCES public.films(id) ON DELETE CASCADE,
  author_id     uuid        NOT NULL    REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  body          text,
  slug          text        NOT NULL UNIQUE,
  view_count    int         NOT NULL DEFAULT 0,
  question_type text,
  -- lifecycle / provenance (§3.2)
  status        text        NOT NULL DEFAULT 'published'
                            CHECK (status IN ('draft','in_review','published','rejected','hidden')),
  source        text        NOT NULL DEFAULT 'human'
                            CHECK (source IN ('human','ai')),
  generated_by  text,
  reviewed_by   uuid        REFERENCES public.profiles(id),
  published_at  timestamptz
);

-- 1d. canonical_answers — one per question (unique), with lifecycle
CREATE TABLE public.canonical_answers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL    DEFAULT now(),
  question_id     uuid        NOT NULL    UNIQUE REFERENCES public.questions(id) ON DELETE CASCADE,
  body            text        NOT NULL,
  updated_by      uuid        REFERENCES public.profiles(id),
  updated_at      timestamptz DEFAULT now(),
  revision_count  int         NOT NULL DEFAULT 0,
  -- lifecycle / provenance (§3.2)
  status          text        NOT NULL DEFAULT 'published'
                              CHECK (status IN ('draft','in_review','published','hidden')),
  source          text        NOT NULL DEFAULT 'human'
                              CHECK (source IN ('human','ai')),
  generated_by    text,
  reviewed_by     uuid        REFERENCES public.profiles(id),
  published_at    timestamptz
);

-- 1e. answer_revisions — full history for rollback
CREATE TABLE public.answer_revisions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL    DEFAULT now(),
  canonical_answer_id uuid        NOT NULL    REFERENCES public.canonical_answers(id) ON DELETE CASCADE,
  body                text        NOT NULL,
  editor_id           uuid        REFERENCES public.profiles(id),
  edit_summary        text
);

-- 1f. contributions — individual user readings, upvote-only
CREATE TABLE public.contributions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL    DEFAULT now(),
  question_id             uuid        NOT NULL    REFERENCES public.questions(id) ON DELETE CASCADE,
  author_id               uuid        NOT NULL    REFERENCES public.profiles(id) ON DELETE CASCADE,
  body                    text        NOT NULL,
  upvotes                 int         NOT NULL DEFAULT 0,
  sort_score              numeric     NOT NULL DEFAULT 0,
  merged_into_canonical   boolean     NOT NULL DEFAULT false,
  -- lifecycle / provenance (§3.2)
  status                  text        NOT NULL DEFAULT 'published'
                                      CHECK (status IN ('draft','in_review','published','rejected','hidden')),
  source                  text        NOT NULL DEFAULT 'human'
                                      CHECK (source IN ('human','ai')),
  generated_by            text,
  published_at            timestamptz
);

-- 1g. comments — one level only, on contributions
CREATE TABLE public.comments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL    DEFAULT now(),
  contribution_id uuid        NOT NULL    REFERENCES public.contributions(id) ON DELETE CASCADE,
  author_id       uuid        NOT NULL    REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            text        NOT NULL
);

-- 1h. votes — existence = one upvote; no value column, no downvote
CREATE TABLE public.votes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL    DEFAULT now(),
  user_id         uuid        NOT NULL    REFERENCES public.profiles(id) ON DELETE CASCADE,
  contribution_id uuid        NOT NULL    REFERENCES public.contributions(id) ON DELETE CASCADE,
  UNIQUE (user_id, contribution_id)
);

-- 1i. flags — quiet abuse reporting (replaces downvotes)
CREATE TABLE public.flags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL    DEFAULT now(),
  user_id     uuid        NOT NULL    REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text        NOT NULL    CHECK (target_type IN ('contribution','question')),
  target_id   uuid        NOT NULL,
  reason      text,
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','resolved','dismissed'))
);

-- 1j. edit_suggestions — proposed canonical edits, queued for review
CREATE TABLE public.edit_suggestions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL    DEFAULT now(),
  canonical_answer_id uuid        NOT NULL    REFERENCES public.canonical_answers(id) ON DELETE CASCADE,
  author_id           uuid        NOT NULL    REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_body       text        NOT NULL,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','rejected')),
  reviewed_by         uuid        REFERENCES public.profiles(id)
);

-- 1k. badges — the 6 milestone badges (§11)
CREATE TABLE public.badges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL    DEFAULT now(),
  key         text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  description text,
  tier        text
);

-- 1l. user_badges — awarded badges
CREATE TABLE public.user_badges (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL   DEFAULT now(),
  user_id   uuid        NOT NULL    REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id  uuid        NOT NULL    REFERENCES public.badges(id) ON DELETE CASCADE,
  UNIQUE (user_id, badge_id)
);

-- 1m. content_events — audit log for AI pipeline + admin actions (§3.2)
CREATE TABLE public.content_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL    DEFAULT now(),
  entity_type text        NOT NULL,
  entity_id   uuid        NOT NULL,
  event       text        NOT NULL
              CHECK (event IN ('generated','verified','published','edited',
                               'rejected','hidden','flag_resolved')),
  actor_id    uuid        REFERENCES public.profiles(id),
  actor_kind  text        NOT NULL
              CHECK (actor_kind IN ('human','ai','system')),
  meta        jsonb
);


-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX idx_questions_film_id       ON public.questions(film_id);
CREATE INDEX idx_questions_question_type ON public.questions(question_type);
CREATE INDEX idx_questions_status        ON public.questions(status);
CREATE INDEX idx_questions_author_id     ON public.questions(author_id);

CREATE INDEX idx_canonical_answers_status ON public.canonical_answers(status);

CREATE INDEX idx_contributions_question_id ON public.contributions(question_id);
CREATE INDEX idx_contributions_status      ON public.contributions(status);
CREATE INDEX idx_contributions_author_id   ON public.contributions(author_id);

CREATE INDEX idx_comments_contribution_id ON public.comments(contribution_id);

CREATE INDEX idx_votes_contribution_id ON public.votes(contribution_id);
CREATE INDEX idx_votes_user_id         ON public.votes(user_id);

CREATE INDEX idx_films_director_slug ON public.films(director_slug);

CREATE INDEX idx_content_events_entity ON public.content_events(entity_type, entity_id);
CREATE INDEX idx_content_events_actor  ON public.content_events(actor_id);

CREATE INDEX idx_flags_target ON public.flags(target_type, target_id);

CREATE INDEX idx_edit_suggestions_canonical ON public.edit_suggestions(canonical_answer_id);

CREATE INDEX idx_answer_revisions_canonical ON public.answer_revisions(canonical_answer_id);


-- ============================================================
-- 3. ROW LEVEL SECURITY — enable on every table, then policies
-- ============================================================

ALTER TABLE public.films             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_revisions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_suggestions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_events    ENABLE ROW LEVEL SECURITY;

-- ----- Helper: check if current user is admin -----
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- 3a. films — public read (no status gating)
-- ============================================================
CREATE POLICY "films: anyone can read"
  ON public.films FOR SELECT
  USING (true);

-- ============================================================
-- 3b. profiles — public read where is_public, own profile always visible
-- ============================================================
CREATE POLICY "profiles: read public profiles"
  ON public.profiles FOR SELECT
  USING (is_public = true OR id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 3c. questions — public read only published; admin reads all
-- ============================================================
CREATE POLICY "questions: read published"
  ON public.questions FOR SELECT
  USING (status = 'published' OR author_id = auth.uid() OR public.is_admin());

CREATE POLICY "questions: authenticated insert as self"
  ON public.questions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
  );

CREATE POLICY "questions: update own"
  ON public.questions FOR UPDATE
  USING (author_id = auth.uid() OR public.is_admin())
  WITH CHECK (author_id = auth.uid() OR public.is_admin());

-- ============================================================
-- 3d. canonical_answers — public read published only; NO client writes
-- ============================================================
CREATE POLICY "canonical_answers: read published"
  ON public.canonical_answers FOR SELECT
  USING (status = 'published' OR public.is_admin());

-- No INSERT/UPDATE/DELETE policies for anon/auth.
-- Canonical edits go through server route / SECURITY DEFINER (Mission 5).

-- ============================================================
-- 3e. answer_revisions — public read (history is transparent); no client writes
-- ============================================================
CREATE POLICY "answer_revisions: read all"
  ON public.answer_revisions FOR SELECT
  USING (true);

-- No INSERT/UPDATE for clients. Server-side only.

-- ============================================================
-- 3f. contributions — public read published; authenticated insert as self
-- ============================================================
CREATE POLICY "contributions: read published"
  ON public.contributions FOR SELECT
  USING (status = 'published' OR author_id = auth.uid() OR public.is_admin());

CREATE POLICY "contributions: authenticated insert as self"
  ON public.contributions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
  );

CREATE POLICY "contributions: update own"
  ON public.contributions FOR UPDATE
  USING (author_id = auth.uid() OR public.is_admin())
  WITH CHECK (author_id = auth.uid() OR public.is_admin());

-- ============================================================
-- 3g. comments — read all (visibility inherits from contribution); insert as self
-- ============================================================
CREATE POLICY "comments: read all"
  ON public.comments FOR SELECT
  USING (true);

CREATE POLICY "comments: authenticated insert as self"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
  );

-- ============================================================
-- 3h. votes — read all; insert/delete own (upvote toggle)
-- ============================================================
CREATE POLICY "votes: read all"
  ON public.votes FOR SELECT
  USING (true);

CREATE POLICY "votes: authenticated insert as self"
  ON public.votes FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

CREATE POLICY "votes: delete own"
  ON public.votes FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 3i. flags — no public read; insert as self
-- ============================================================
CREATE POLICY "flags: admin read"
  ON public.flags FOR SELECT
  USING (public.is_admin());

CREATE POLICY "flags: authenticated insert as self"
  ON public.flags FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

-- ============================================================
-- 3j. edit_suggestions — read own + admin; insert as self
-- ============================================================
CREATE POLICY "edit_suggestions: read own or admin"
  ON public.edit_suggestions FOR SELECT
  USING (author_id = auth.uid() OR public.is_admin());

CREATE POLICY "edit_suggestions: authenticated insert as self"
  ON public.edit_suggestions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND author_id = auth.uid()
  );

-- ============================================================
-- 3k. badges — public read
-- ============================================================
CREATE POLICY "badges: anyone can read"
  ON public.badges FOR SELECT
  USING (true);

-- No client writes. Server/trigger only.

-- ============================================================
-- 3l. user_badges — public read
-- ============================================================
CREATE POLICY "user_badges: anyone can read"
  ON public.user_badges FOR SELECT
  USING (true);

-- No client writes. Server/trigger only.

-- ============================================================
-- 3m. content_events — admin only
-- ============================================================
CREATE POLICY "content_events: admin read"
  ON public.content_events FOR SELECT
  USING (public.is_admin());

-- No client writes. Server/pipeline only.


-- ============================================================
-- 4. TRIGGER: handle_new_user — auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
