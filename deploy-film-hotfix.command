#!/usr/bin/env bash
# ============================================================
# Metatake — URGENT HOTFIX. Film pages are crashing.
# Cause: the film page's load() returned without `readings`/`tropes`,
#   so the component hit `readings.length` on undefined → every film
#   page threw. Fix: return them. (Single-file, lowest-risk deploy.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add app/film/'[slug]'/page.tsx
git commit -m "Hotfix: film page crashed — load() now returns readings + tropes"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Film pages should open again,"
echo "   e.g. https://metatake.net/film/tropical-malady-2004"
echo "Press Enter to close..."; read -r _
