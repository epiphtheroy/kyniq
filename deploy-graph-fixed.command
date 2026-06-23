#!/usr/bin/env bash
# ============================================================
# Metatake — Obsidian-style connection graph on film + figure pages.
#   Why the uploaded deploy-entity-graph.command failed: it git-add'd files not
#   in the repo (a 0024 migration that doesn't exist — its RPCs are ALREADY live
#   as graph_film_seed / graph_figure_seed) and the pages weren't wired to the
#   graph yet. Fixed here:
#
#   • components/EntityGraph.tsx        — the force graph (already present).
#   • components/EntityGraphLoader.tsx  — NEW: lazily fetches the seed RPC on the
#     client and hands it to EntityGraph (keeps the big payload out of SSR HTML).
#   • Film page  : graph mounted just below the poster.
#   • Figure page: graph mounted just below the definition.
#   • Removed the old bottom NodeGraph from BOTH pages (one graph, not two).
#   No migration needed: the seed RPCs already exist in the database.
#   (Leaves the paused homepage redesign — app/page.tsx — untouched.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add \
  components/EntityGraph.tsx \
  components/EntityGraphLoader.tsx \
  components/EntityGraph.README.md \
  "app/film/[slug]/page.tsx" \
  "app/film/[slug]/figure/[figureSlug]/page.tsx" \
  app/globals.css
git commit -m "Connection graph: Obsidian-style EntityGraph on film + figure pages (lazy loader; replaces bottom NodeGraph)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min)."
echo "   Any film page → graph under the poster; any figure page → graph under the definition."
echo "   Drag a node (neighbours follow), hover to focus, click a node to travel."
echo "Press Enter to close..."; read -r _
