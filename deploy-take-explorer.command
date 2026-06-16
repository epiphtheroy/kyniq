#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: meta-take page search + random example.
# Double-click: commit + push to origin/main (Vercel auto-deploy).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Meta-take page: in-page take search + random example

The 'All takes' section can hold 100+ cases buried in folders. TakeExplorer
(replaces FolderToggle) adds a search box that filters rows across the active
genre/register view and auto-opens folders with matches, plus a 🎲 Random
button that surfaces a random visible case (opens its folder, scrolls, flashes).
Take rows now carry searchable data attributes."
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys (~1-2 min)."
echo "Press Enter to close..."; read -r _
