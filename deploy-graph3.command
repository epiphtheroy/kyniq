#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: connections explorer (directory-style drill-down).
# Replaces the radial force graph (labels overlapped) with breadcrumb tabs +
# a downward neighbour list. Double-click: commit + push to origin/main.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Connections explorer: directory-style drill-down (replaces radial graph)

- breadcrumb tabs grow sideways as you drill; the current node's neighbours
  list downward; click a row to go deeper, click a tab to go back, ↗ opens page
- fixes the label overlap of the radial layout; readable on mobile
- uses the same graph_* RPCs (0018); drops the d3-force dependency"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "Press Enter to close..."; read -r _
