-- ============================================================
-- Migration 0014 — Figure pages + contribution layer
-- Figures become first-class pages (/film/[slug]/figure/[fig-slug]).
-- Each figure gathers takes diversified by CRITICAL REGISTER (route)
-- that converge on shared meta takes (destination). Logged-in users
-- can add takes (meta take required) and add figures under a film.
-- See: figure-page-design.md (authoritative for figures).
-- Builds on 0013_metatake.sql. Idempotent (ADD COLUMN IF NOT EXISTS).
-- ============================================================

-- ── figures: slug (rename-safe) + contributor + reviewer ──────
ALTER TABLE public.figures
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.profiles(id),   -- UGC figure
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id);
-- status already exists (default 'approved'); UGC enters as 'in_review'.
-- source already exists (default 'ai'); UGC = 'human'.
-- slug is unique WITHIN a film (label collides across films).
CREATE UNIQUE INDEX IF NOT EXISTS uq_figures_film_slug ON public.figures(film_id, slug);

-- ── takes: register/angle + contributor + moderation + upvotes ─
ALTER TABLE public.takes
  ADD COLUMN IF NOT EXISTS register text          -- critical register (route), figure-page-design §6.1
       CHECK (register IN ('formal','semiotic','psychoanalytic','ideological',
              'politico_economic','philosophical','existential','mythic',
              'genealogical','reception')),
  ADD COLUMN IF NOT EXISTS angle text,            -- free sub-angle label (30-prompt palette)
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
       CHECK (status IN ('draft','in_review','published','rejected')),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ai'
       CHECK (source IN ('ai','human')),
  ADD COLUMN IF NOT EXISTS upvotes int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_takes_register ON public.takes(register);
CREATE INDEX IF NOT EXISTS idx_takes_status   ON public.takes(status);
-- Existing seed takes are source='ai', status='published' (defaults match).
-- register backfill (theory_family → register) runs separately; null until then.

-- ── upvotes (upvote-only invariant #2, one per user) ──────────
CREATE TABLE IF NOT EXISTS public.take_votes (
  take_id uuid NOT NULL REFERENCES public.takes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (take_id, user_id)
);

-- ── slug_history: allow 'figure' entity (301 on rename) ───────
ALTER TABLE public.slug_history DROP CONSTRAINT IF EXISTS slug_history_entity_check;
ALTER TABLE public.slug_history
  ADD CONSTRAINT slug_history_entity_check
  CHECK (entity IN ('meta_take','film','director','figure'));

-- ── published-take count per figure (page density / gate badge) ─
CREATE OR REPLACE VIEW public.figure_take_counts AS
  SELECT figure_id, count(*)::int AS take_count
  FROM public.takes
  WHERE status = 'published' AND meta_take_id IS NOT NULL
  GROUP BY figure_id;

-- ── distinct-register count per figure (diversity check) ──────
CREATE OR REPLACE VIEW public.figure_register_counts AS
  SELECT figure_id, count(DISTINCT register)::int AS register_count
  FROM public.takes
  WHERE status = 'published' AND register IS NOT NULL
  GROUP BY figure_id;

-- ── RLS ──────────────────────────────────────────────────────
-- takes: currently "USING (true)" (all public). Tighten for UGC:
-- published, or your own (any status), or admin.
DROP POLICY IF EXISTS "takes: read" ON public.takes;
CREATE POLICY "takes: read" ON public.takes FOR SELECT USING (
  status = 'published' OR author_id = auth.uid() OR public.is_admin()
);
-- logged-in users insert takes in their own name; held for review.
CREATE POLICY "takes: insert own" ON public.takes FOR INSERT WITH CHECK (
  author_id = auth.uid() AND source = 'human' AND status = 'in_review'
);
-- authors may edit their own non-published takes; admin anything.
CREATE POLICY "takes: update own or admin" ON public.takes FOR UPDATE USING (
  (author_id = auth.uid() AND status IN ('draft','in_review','rejected')) OR public.is_admin()
);

-- figures: show own in_review figures to their author too.
DROP POLICY IF EXISTS "figures: read" ON public.figures;
CREATE POLICY "figures: read" ON public.figures FOR SELECT USING (
  status = 'approved' OR author_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "figures: insert own" ON public.figures FOR INSERT WITH CHECK (
  author_id = auth.uid() AND source = 'human' AND status = 'in_review'
);
CREATE POLICY "figures: update own or admin" ON public.figures FOR UPDATE USING (
  (author_id = auth.uid() AND status <> 'approved') OR public.is_admin()
);

-- take_votes: each user manages only their own votes.
ALTER TABLE public.take_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "take_votes: read" ON public.take_votes FOR SELECT USING (true);
CREATE POLICY "take_votes: write own" ON public.take_votes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- NOTE (moderation = "review-then-publish", figure-page-design §7.4 M1):
-- human inserts are forced to status in_review/human by the policies above.
-- A server action / admin queue flips to 'published' + sets reviewed_by.
-- If you switch to "publish-then-audit", relax the insert CHECK to allow
-- status='published' for trusted roles.
