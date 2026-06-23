#!/usr/bin/env bash
# ============================================================
# Metatake — graph: move position + caption + expand.
#   • Film page : graph moved DOWN to sit below the Figures section.
#   • Figure page: graph moved DOWN to sit below the Takes section.
#   • Caption above each graph: "Connection map · {film/figure}" + a line
#     explaining it's built from AI embeddings (nearest in meaning) and how to
#     interact (drag / hover / click).
#   • "Expand" button enlarges the graph (≈820px) and "Collapse" returns it.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add components/EntityGraphLoader.tsx "app/film/[slug]/page.tsx" "app/film/[slug]/figure/[figureSlug]/page.tsx" app/globals.css
git commit -m "Graph: move below Figures (film) / below Takes (figure); add AI-embedding caption + Expand toggle"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min)."
echo "   Film page → graph below Figures; figure page → graph below Takes; caption + Expand on both."
echo "Press Enter to close..."; read -r _
