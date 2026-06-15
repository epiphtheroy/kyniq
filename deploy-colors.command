#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: map back to bottom + sourced title/desc + entity link colours.
# Double-click: commit + push to origin/main (Vercel auto-deploy).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Map to bottom + sourced title/desc + entity link colour system

- connections map moved back to the bottom of film/meta-take/figure pages
- map box: title now names the source node + a one-line description of the map;
  rows and breadcrumb tabs are coloured by entity type
- link colour system (by href, all pages): meta take = red, figure = blue
  (TV-Tropes-ish), film/director/structural = neutral dark — no more all-red"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "Press Enter to close..."; read -r _
