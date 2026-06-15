#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: figure links everywhere + contribution form.
# Double-click: commit everything and push to origin/main (Vercel auto-deploy).
# DB changes (all figure slugs backfilled) were already applied live via connector.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Figure links everywhere + 'add your take' contribution layer

- backfilled figures.slug for all 4626 figures (was 20) -> every figure linkable
- meta-take detail page: figure labels now link to their figure pages
- figure page: real contribution form (design 7.1) replaces the placeholder CTA
  - login-gated; meta-take select (required, grouped by theory family)
  - critical register select (required) + rationale (required)
  - inserts source=human status=published (immediate publish, per decision)
  - contributor sees their own takes inline; human takes get a Community badge
- migration 0017: takes insert policy allows status=published for human authors
- CSS for the form, badges, and linked figure labels"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "Press Enter to close..."; read -r _
