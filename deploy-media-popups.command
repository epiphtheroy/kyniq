#!/usr/bin/env bash
# ============================================================
# FilmCurio — dek-duplication fix + media popups deploy
# Double-click to run. Commits and pushes to origin/main,
# which triggers Vercel's auto-deploy.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
echo
echo "── Files that will be committed ──────────────────────────"
git status --short
echo "──────────────────────────────────────────────────────────"
echo

git add -A
git commit -m "fix+feat: no dek for single-paragraph answers (was printing the full answer twice), image lightbox popup (hero + stills), floating bottom-right YouTube mini-player independent of article scroll"

echo
echo "── Pushing to origin/main (this triggers the Vercel deploy) ──"
git push origin main

echo
echo "✅ Pushed. Vercel auto-deploys from 'main' — check the live site in ~1-2 minutes."
read -r -p "Press Enter to close..."
