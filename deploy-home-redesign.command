#!/usr/bin/env bash
# ============================================================
# Metatake — homepage redesign (content-forward, news-style boxes).
#   • Hero "Reading of the day": a featured cross-film reading (random each
#     cache cycle) with its laconic + 3 real film/figure/text examples.
#   • News-style boxes: Latest readings (text snippets) · Tropes · Most-
#     connected readings · Explore.
#   • Box-in-box: the Tropes box spotlights ONE trope with its actual figures
#     (film — figure), then lists more tropes below.
#   Keeps Metatake's serif headlines + economist-red accents.
#   (Data comes from the new home_payload() RPC — already live in the DB.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add app/page.tsx app/globals.css
git commit -m "Homepage redesign: featured connection hero + news-style boxes + trope box-in-box spotlight"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open the homepage:"
echo "   a featured reading up top, then Latest / Tropes (with a spotlighted trope) /"
echo "   Most-connected / Explore boxes. Reload a few times — the hero + spotlight rotate."
echo "Press Enter to close..."; read -r _
