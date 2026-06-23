#!/usr/bin/env bash
# ============================================================
# Metatake — embed the Obsidian-style connection graph on film + figure pages.
#   • components/EntityGraph.tsx — zero-dependency force graph: text nodes,
#     drag-with-gravity (neighbours follow), hover focus, click-to-navigate,
#     pan/zoom. Settles dynamically every time the page opens.
#   • supabase/migrations/0024_graph_seeds.sql — graph_film_seed /
#     graph_figure_seed RPCs (a graph-ready { nodes, links } in one call).
#     ⚠ ALREADY APPLIED to the live database; committed here only to keep
#     the repo's migration history in sync.
#   • Film page  : graph sits just below the image, at body width.
#   • Figure page: graph sits just below the definition, larger.
#
# This script BUILDS locally first and only pushes (→ Vercel deploy) if the
# build passes — so a typo can never half-deploy the site.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

# 1) Safety gate — build locally; abort the deploy if it fails.
echo
echo "▶ Building (npm run build) — verifying the site will deploy cleanly…"
echo "  (first run can take a couple of minutes)"
if ! npm run build; then
  echo
  echo "✗ Build FAILED — nothing was pushed, the live site is untouched."
  echo "  Fix the errors shown above (or send them to me) and double-click again."
  echo "Press Enter to close..."; read -r _; exit 1
fi
echo "  ✓ Build passed."

# 2) Stage the graph feature
echo
echo "▶ Committing…"
git add \
  components/EntityGraph.tsx \
  components/EntityGraph.README.md \
  supabase/migrations/0024_graph_seeds.sql \
  "app/film/[slug]/page.tsx" \
  "app/film/[slug]/figure/[figureSlug]/page.tsx"

git commit -m "Connection graph: Obsidian-style force graph on film + figure pages

- EntityGraph.tsx: zero-dependency force graph with text nodes, drag-with-
  gravity (drag a node and its neighbours follow), hover focus, click-to-
  navigate, pan + zoom; the layout settles dynamically on each page open.
- graph_film_seed / graph_figure_seed RPCs (migration 0024) return a
  graph-ready { nodes, links } payload in one call (already applied to the DB).
- Film page: graph rendered just below the image (body width).
  Figure page: graph rendered just below the definition (larger).
- Existing reading/kin/trope lists and the bottom NodeGraph are kept as-is;
  the graph is an additive visual layer (progressive enhancement)." || true

# 3) Push → Vercel auto-deploys from main
echo
echo "▶ Pushing to origin/main…"
git push origin main

echo
echo "✅ Pushed. Vercel rebuilds (~1–2 min)."
echo "   Verify after deploy:"
echo "     • any film page   → graph just under the poster / title"
echo "     • any figure page → graph just under the definition"
echo "   Drag a node (neighbours follow), hover to focus, click a node to travel."
echo "Press Enter to close..."; read -r _
