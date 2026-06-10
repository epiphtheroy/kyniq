#!/usr/bin/env bash
# ============================================================
# FilmCurio — v2 "Reading Instrument" design deploy
# Run on YOUR Mac (where git/SSH/Vercel auth lives):
#     cd ~/Documents/filmcurio   # (or wherever this repo is)
#     bash deploy-v2.sh
# It commits all v2 changes and pushes to origin/main,
# which triggers Vercel's auto-deploy.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
echo

# Clear stray temp objects + any partial staging left by the sandbox attempt
# (working tree is never touched by these)
git gc --prune=now 2>/dev/null || true
git reset -q 2>/dev/null || true

echo "── Files that will be committed ──────────────────────────"
git status --short
echo "──────────────────────────────────────────────────────────"
echo

# If worker/Dockerfile shows as modified but you did NOT change it,
# it's a stray artifact — uncomment the next line to discard it:
# git checkout -- worker/Dockerfile 2>/dev/null || true

git add -A
git commit -m "design: v2 Reading Instrument — near-mono text-first redesign, dot logo, SPEC/AGENTS, home rail"

echo
echo "── Pushing to origin/main (this triggers the Vercel deploy) ──"
git push origin main

echo
echo "✅ Pushed to GitHub. Vercel auto-deploys from 'main'."
echo "   Watch the build at https://vercel.com/  → your FilmCurio project."
