#!/usr/bin/env bash
# CHARACTERS — fast path. Cancels the queued batch, then maps all 3,100 character figures
# in real time (concurrent, Sonnet) → figure_taxonomy. Finishes in a few minutes.
# Cost ≈ 2× batch (~$24) but no queue wait. Quality already reviewed in the DRY.
# Needs .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
if ! grep -q '^ANTHROPIC_API_KEY=' .env.local 2>/dev/null; then
  echo "⚠️  ANTHROPIC_API_KEY not found in .env.local"; echo "Press Enter to close…"; read -r _; exit 1
fi
echo "▶ cancelling the queued character batch (avoids double work + charge) …"
python3 worker/catalog-map-char.py --cancel || true
echo
echo "▶ real-time mapping of all character figures (concurrent) → figure_taxonomy …"
python3 worker/catalog-map-char.py --sync --workers 8 || { echo "sync failed"; read -r _; exit 1; }
echo "Press Enter to close…"; read -r _
