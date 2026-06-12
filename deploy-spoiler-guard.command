#!/usr/bin/env bash
# ============================================================
# FilmCurio — Spoiler Guard deploy
# Double-click to run. Commits the spoiler-guard changes and
# pushes to origin/main, which triggers Vercel's auto-deploy.
# See: spoiler-guard-design.md
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
git commit -m "feat: spoiler guard — in-call spoiler grading (spoiler_level/title_spoiler/display_title/safe_hook), emoji-masked titles on list surfaces, SpoilerShield banner+blur on question pages, safe hooks in feed teasers, backfill scripts + migration 0010"

echo
echo "── Pushing to origin/main (this triggers the Vercel deploy) ──"
git push origin main

echo
echo "✅ Pushed. Vercel auto-deploys from 'main' — check the live site in ~1-2 minutes."
read -r -p "Press Enter to close..."
