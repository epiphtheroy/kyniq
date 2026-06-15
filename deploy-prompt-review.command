#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: pre-batch prompt review tidy + figure JSON-LD.
# (Worker prompt change runs from your Mac; the figure JSON-LD is the web part.)
# Double-click: commit + push to origin/main (Vercel auto-deploy).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Pre-batch prompt review: figure desc names the film, drop film_intro, figure JSON-LD

- figure-enrich prompt: the figure DESCRIPTION must name the film once (so a figure
  reads standalone); removed the unused film_intro generation (we ship no film blurb)
- figure page: add Article JSON-LD (about: Movie, editor: Wonwoo Yoon, dates) for SEO"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "Press Enter to close..."; read -r _
