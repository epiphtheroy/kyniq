#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: graph polish + film/director index pages + Theorist row removal.
# Double-click: commit + push to origin/main (Vercel auto-deploy).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Graph polish + film/director index redesign + drop Theorist row

- connections graph: thinner lines, wider connector rail, internal scroll
  (bounded height), moved directly under the info box on film/meta-take/figure
- /film: redesigned like meta-takes (.mt-wrap + 'By genre' / 'By decade' tabs)
- /director: NEW index page (was a 404) — 'By nationality' (normalised) / 'A–Z'
- meta-take info box: remove the Theorist row (we don't navigate by theorist)"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "Press Enter to close..."; read -r _
