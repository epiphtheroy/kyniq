#!/usr/bin/env bash
# ============================================================
# Metatake — deploy the rebrand + figure pages batch.
# Double-click: commit everything and push to origin/main (Vercel auto-deploy).
# Code only; the figure data was already persisted to the DB separately.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Metatake rebrand + figure pages

- domain filmcurio.com -> metatake.net; brand FilmCurio -> Metatake (code-wide)
- red 'M' logo + full favicon/icon set + og-image; about page rewritten for Metatake
- metatake-page typography: 15px, weight 350 (Inter variable), red links (#E3120B) w/ hover
- figure page route /film/[slug]/figure/[fig-slug] with register-tagged readings
- film-page figure labels now hyperlink to figure pages; home 'new figure pages' module
- figure-enrich v2 worker (Gemini 3.1 Pro, one-call-per-film, 10-register palette,
  ref-integrity, chunked +label-fallback); migration 0014 (figure slug + contribution cols)"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "Press Enter to close..."; read -r _
