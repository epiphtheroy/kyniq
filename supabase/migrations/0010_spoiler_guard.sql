-- Migration: Spoiler guard columns
-- The generator now judges spoiler exposure in the same single call
-- (spoiler_level / title_spoiler / question_display / hook).
-- See: spoiler-guard-design.md, prompt-featured-qa.md (Spoiler gate)

-- Questions: spoiler grading + list-surface surrogates
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS spoiler_level text
  CHECK (spoiler_level IN ('none', 'mild', 'major'));
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS title_spoiler boolean DEFAULT false;
-- Emoji-masked title shown on list surfaces (feed, film page, related, search).
-- NULL → use the real title. The real title always stays in <h1>/<title>/JSON-LD.
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS display_title text;
-- Spoiler-free one-sentence teaser used instead of the answer opening in list
-- previews when spoiler_level = 'major'. NULL → fall back to the body teaser.
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS safe_hook text;

-- Canonical answers: provenance mirror of the grade the answer was shipped with
ALTER TABLE public.canonical_answers ADD COLUMN IF NOT EXISTS spoiler_level text
  CHECK (spoiler_level IN ('none', 'mild', 'major'));

-- Legacy rows keep spoiler_level NULL → the UI treats NULL as "unknown/legacy"
-- (badge-light behaviour, no blur). A reaudit-loop backfill can grade them later.
