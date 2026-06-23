#!/usr/bin/env bash
# ============================================================
# Metatake — homepage redesign "Living Paper" (real data) + graph everywhere.
#   Homepage (app/page.tsx):
#     • Hero "The unconscious lines between films." + thesis line.
#     • Live counters (count-up): Films / Figures / Takes / Meta takes / Tropes
#       (real counts via home_counts RPC).
#     • Reading of the moment: a random real meta-take + 3 real film examples,
#       with its live embedding graph.
#     • ★ "Wander at random" — a dense wall of MANY real detail pages drawn at
#       random (readings, tropes, figures, films) with real snippets; a Shuffle
#       button pulls a fresh random draw (home_pool RPC). This is the point of
#       the page: lots of our detail pages, surfaced at random.
#     • "Just added" — newest readings.
#   New: components/Counters.tsx, components/RandomWall.tsx.
#   Also ships (already in your working tree): EntityGraphLoader now supports
#   metatake/trope graphs, and the take + trope pages mount their own graph.
#   DB RPCs (home_counts, home_pool, graph_metatake_seed, graph_trope_seed) are
#   already live — no migration needed.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add \
  app/page.tsx \
  components/Counters.tsx \
  components/RandomWall.tsx \
  components/EntityGraphLoader.tsx \
  "app/take/[slug]/page.tsx" \
  "app/trope/[slug]/page.tsx" \
  app/globals.css
git commit -m "Homepage 'Living Paper': hero + live counters + featured reading graph + random detail-page wall; graph on take/trope pages"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open the homepage — reload or hit Shuffle to redraw the random wall."
echo "Press Enter to close..."; read -r _
