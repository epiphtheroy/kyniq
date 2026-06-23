#!/usr/bin/env bash
# ============================================================
# Metatake — connection graph polish (6 fixes).
#   1. Film page had TWO graphs (a leftover server-fetched one + the loader) —
#      now ONE.
#   2. Film graph moved down: it appears after the film's info/overview
#      (no longer pinned to the very top).
#   3. Smaller graph (film 400px, figure 520px) + the graph clears the right
#      info box (clear:both) so it never overlaps it.
#   4. Canvas is now WHITE (was black); node dots are category-coloured and
#      labels are dark with a white halo — readable on white.
#   5. Calmer spawn: lower starting energy + more damping so it settles gently
#      instead of flinging around.
#   6. Figure page: the Search images / Search clips buttons moved up to sit
#      right under the info box (no longer beneath the graph).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add components/EntityGraph.tsx "app/film/[slug]/page.tsx" "app/film/[slug]/figure/[figureSlug]/page.tsx" app/globals.css
git commit -m "Graph polish: one graph per film, placed lower + smaller, white canvas + readable labels, calmer motion, figure search buttons under info box"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Check a film page (one white graph below the overview)"
echo "   and a figure page (search buttons under the info box)."
echo "Press Enter to close..."; read -r _
