#!/usr/bin/env bash
# ============================================================
# FilmCurio — v3 "Newspaper" (Economist-style) design deploy
# Double-click to run. Commits all v3 changes and pushes to
# origin/main, which triggers Vercel's auto-deploy.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
echo

git gc --prune=now 2>/dev/null || true
git reset -q 2>/dev/null || true

echo "── Files that will be committed ──────────────────────────"
git status --short
echo "──────────────────────────────────────────────────────────"
echo

git add -A
git commit -m "design: v3 Newspaper — Economist-style mobile redesign (red-box masthead, lead story, story rows, dark brief module, article kicker/dek/dropcap/endmark)"

echo
echo "── Pushing to origin/main (this triggers the Vercel deploy) ──"
git push origin main

echo
echo "✅ Pushed to GitHub. Vercel auto-deploys from 'main'."
