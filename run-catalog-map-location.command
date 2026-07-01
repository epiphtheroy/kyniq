#!/usr/bin/env bash
# Catalog mapping PRODUCTION — LOCATIONS, Sonnet via Batch API → figure_taxonomy.
# Same two-phase flow as objects: Phase 1 submits + validates + costs (NO write);
# you review, press Enter; Phase 2 writes from the SAME batch (no extra API cost).
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
echo " PHASE 1 — submit LOCATION batch, validate, cost (NO DB write)"
echo "════════════════════════════════════════════════════════════"
python3 worker/catalog-map-run.py --kind location --no-write || { echo "phase 1 failed"; read -r _; exit 1; }

echo
echo "Review the summary above (ok / abstain / dropped codes / rows-by-axis / cost)."
echo "Press Enter to WRITE to figure_taxonomy, or Ctrl-C to inspect"
echo "Element/catalog-map-location-results.jsonl first."
read -r _

echo "════════════════════════════════════════════════════════════"
echo " PHASE 2 — write to figure_taxonomy (resumes the same batch)"
echo "════════════════════════════════════════════════════════════"
python3 worker/catalog-map-run.py --kind location || { echo "phase 2 failed"; read -r _; exit 1; }

echo "Press Enter to close…"; read -r _
