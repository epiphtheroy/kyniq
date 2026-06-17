#!/usr/bin/env bash
# ============================================================
# Metatake — commit trope workers/docs + trigger redeploy (busts ISR cache so
# the 169 new tropes show on /tropes immediately instead of waiting ~5 min).
# No app-code change; this just records the workers and refreshes the cache.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add -A
git commit -m "Tropes stage 1+2 workers (trope-tag, trope-build) + KEPT notes; refresh tropes"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min) → /tropes shows all 169 tropes."
echo "Press Enter to close..."; read -r _
