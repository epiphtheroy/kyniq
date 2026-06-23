#!/usr/bin/env bash
# ============================================================
# Metatake — connection graph on the HUB pages (meta-take + trope).
# Mirrors the film/figure graph, inverted: a reading or a trope at the centre.
#   • /take/[slug]  (meta-take/reading): centre = the reading; around it the
#     member figures across films + the nearest neighbouring readings (embedding).
#   • /trope/[slug] (figure-type): centre = the trope; around it the member
#     figures across films + the readings those figures receive
#     (= what this device tends to MEAN — the cross-axis).
#
# Ships:
#   • components/EntityGraphLoader.tsx — now also handles kind "metatake"/"trope".
#   • app/take/[slug]/page.tsx, app/trope/[slug]/page.tsx — graph below the definition.
#   • supabase/migrations/0024_graph_seeds.sql, 0025_graph_seeds_hub.sql
#     (graph_film_seed / graph_figure_seed / graph_metatake_seed / graph_trope_seed).
#     ⚠ ALL FOUR RPCs are ALREADY APPLIED to the live database; the SQL files are
#       committed here only to keep the repo's migration history in sync.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

git add \
  components/EntityGraphLoader.tsx \
  "app/take/[slug]/page.tsx" \
  "app/trope/[slug]/page.tsx" \
  supabase/migrations/0024_graph_seeds.sql \
  supabase/migrations/0025_graph_seeds_hub.sql

git commit -m "Hub graphs: connection graph on meta-take + trope pages

- EntityGraphLoader: add kind 'metatake' and 'trope' (calls graph_metatake_seed /
  graph_trope_seed). Reuses the same Obsidian-style EntityGraph (no renderer change).
- /take page: graph below the thesis — the reading, its member figures across
  films, and the nearest neighbouring readings (embedding cosine).
- /trope page: graph below the thesis — the trope, its member figures across
  films, and the readings those figures receive (what the device tends to mean).
- Migrations 0024 (film/figure seeds) + 0025 (metatake/trope seeds) committed to
  keep history in sync; the RPCs are already live on the database." || true

echo
echo "▶ Pushing to origin/main…"
git push origin main

echo
echo "✅ Pushed. Vercel rebuilds (~1–2 min)."
echo "   Verify after deploy:"
echo "     • any /take page  → graph below the thesis (reading + figures + near readings)"
echo "     • any /trope page → graph below the thesis (trope + figures + meanings)"
echo "   Drag a node (neighbours follow), hover to focus, click a node to travel."
echo "Press Enter to close..."; read -r _
