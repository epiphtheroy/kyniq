#!/usr/bin/env bash
# ============================================================
# Metatake — graph caption, made page-aware.
#   The connection graph is ALREADY live on the meta-take (/take) and trope
#   (/trope) pages (shipped earlier, below the thesis — mid-body, same Obsidian
#   format as the film/figure pages). This change only refines the caption so it
#   reads appropriately per page type:
#     • reading : "this reading, the films and figures that carry it, and the
#                  readings nearest it in meaning"
#     • trope   : "this trope, the figures and films that share it, and the
#                  readings those figures receive"
#     • figure / film keep their own phrasings.
#   One file: components/EntityGraphLoader.tsx. No migration (RPCs already live).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add components/EntityGraphLoader.tsx
git commit -m "Graph caption: page-aware blurb for reading / trope / figure / film hubs"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open a /take and a /trope page —"
echo "   the graph sits below the thesis with a caption tailored to that page."
echo "Press Enter to close..."; read -r _
