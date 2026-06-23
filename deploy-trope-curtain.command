#!/usr/bin/env bash
# ============================================================
# Metatake — Trope page: click-to-expand "curtain" member rows.
# On /trope/[slug], each figure row now expands in place to show the
# figure's description + the readings it takes part in, with an
# "Open →" shortcut to the full figure page. No more clicking through
# every figure just to see what it is.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add "app/trope/[slug]/page.tsx" app/globals.css
git commit -m "Trope page: expandable 'curtain' member rows (description + readings inline) + Open shortcut"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open any trope, e.g. /tropes -> a trope,"
echo "   then click a figure row to expand it; use 'Open →' to jump to the full page."
echo "Press Enter to close..."; read -r _
