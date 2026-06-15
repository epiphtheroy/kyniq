#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: Obsidian-style force-directed node graph (map) on every page.
# Double-click: commit everything and push to origin/main (Vercel auto-deploy).
# DB (migration 0018 graph_* RPCs) already applied live via connector.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Force-directed node graph (Obsidian-style map) on every page

- migration 0018: graph_* neighbor RPCs — film (affinity score),
  meta-take (embedding cosine), figure (shared meta-takes), take siblings
- NodeGraph: lightweight SVG force simulation at the bottom of
  film / meta-take / figure pages; in-graph re-center on node click;
  small ↗ opens that node's page; edge thickness + number = relatedness
- figure reading cards: lazy take→meta-take→kindred-takes mini-graph
- .gitignore: *.log"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "Press Enter to close..."; read -r _
