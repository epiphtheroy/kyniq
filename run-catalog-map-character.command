#!/usr/bin/env bash
# CHARACTERS PRODUCTION — Sonnet via Batch API → figure_taxonomy (multi-label Axis1+Axis3+archetype+themes).
# Phase 1 submits + validates + costs (NO write); review; Enter; Phase 2 writes from the SAME batch.
# Needs .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
if ! grep -q '^ANTHROPIC_API_KEY=' .env.local 2>/dev/null; then
  echo "⚠️  ANTHROPIC_API_KEY not found in .env.local"; echo "Press Enter to close…"; read -r _; exit 1
fi
echo "════════════════════════════════════════════════════════════"
echo " PHASE 1 — submit CHARACTER batch, validate, cost (NO DB write)"
echo "════════════════════════════════════════════════════════════"
python3 worker/catalog-map-char.py --no-write || { echo "phase 1 failed"; read -r _; exit 1; }
echo
echo "Review the summary above. Press Enter to WRITE to figure_taxonomy, or Ctrl-C to inspect"
echo "Element/catalog-map-character-results.jsonl first."
read -r _
echo "════════════════════════════════════════════════════════════"
echo " PHASE 2 — write to figure_taxonomy (resumes the same batch)"
echo "════════════════════════════════════════════════════════════"
python3 worker/catalog-map-char.py || { echo "phase 2 failed"; read -r _; exit 1; }
echo "Press Enter to close…"; read -r _
