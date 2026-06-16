#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: discovery features (random / latest / trending / seq-nav).
# Double-click: commit + push to origin/main (Vercel auto-deploy).
# (Migrations 0021–0023 already applied to the live DB.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "TVTropes-style discovery: random, latest, trending, sequential nav

A — Random: homepage 'a reading, at random' showcase with shuffle; nav
  Random ▾ dropdown (take / meta-take / film); routes /random/film,
  /random/meta-take, /random/take (jumps to the take on its figure page).
C — Sequential nav: '‹ Prev · Index · Next ›' box on meta-take / figure /
  film pages (within family / film / director), above the node graph.
B — Latest: /latest page + homepage strip + nav link.
B — Trending: /trending (This week / All time), blends views + likes +
  connectedness; view_events table now accrues daily for weekly ranking.
Migrations 0021 (random RPCs), 0022 (seq_nav), 0023 (trending + view_events)."
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys (~1-2 min)."
echo "Press Enter to close..."; read -r _
