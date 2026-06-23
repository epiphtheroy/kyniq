#!/usr/bin/env bash
# ============================================================
# Metatake — homepage tweaks (3 requests).
#   1. "Reading of the moment" now shows a film still (backdrop, b/w) top-right.
#   2. Random wall: reading & trope cards now list their RELATED FILMS as the
#      body (card still links to the reading/trope page); film cards now show a
#      still thumbnail (backdrop, not a poster). (home_pool RPC already updated.)
#   3. An "Ask Metatake" box added below "Just added" → routes to /ask?q=… and
#      /ask now auto-runs that query.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add app/page.tsx components/RandomWall.tsx components/AskBox.tsx "app/ask/page.tsx" app/globals.css
git commit -m "Home: featured film still; random wall lists related films + film thumbnails; Ask box (routes to /ask?q, auto-runs)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Reload the homepage; try the Ask box and Shuffle."
echo "Press Enter to close..."; read -r _
