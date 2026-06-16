#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: sticky header + in-page list filters.
# Double-click: commit + push to origin/main (Vercel auto-deploy).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Sticky header + in-page list filters (scoped, instant)

- nav is now sticky (global search stays reachable on long pages)
- ListFilter: client-side instant narrowing of an already server-rendered list
  (SSR/links preserved); added to /film, /director, /meta-takes, /genre/[slug]
- distinguishes global search (jump anywhere, in header) from in-page filter
  (refine this list, no navigation)"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys (~1-2 min)."
echo "Press Enter to close..."; read -r _
