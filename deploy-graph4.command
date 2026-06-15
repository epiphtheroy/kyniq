#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: connections explorer v2 (line rail + animation + deletable tabs).
# Keeps the readable categorical list, adds curved connector lines + motion so it
# feels like a live map. Double-click: commit + push to origin/main.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Connections explorer v2: connector-line rail + animation + deletable tabs

- keep the readable categorical list; add a left rail of curved lines from the
  current node to each neighbour (thickness = relatedness) → the dynamic graph feel
- rows + lines animate in on every drill (reads as live in-map navigation)
- breadcrumb tabs get × (remove a step) and a 'clear' (back to start)
- respects prefers-reduced-motion"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "Press Enter to close..."; read -r _
