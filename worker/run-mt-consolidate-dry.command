#!/usr/bin/env bash
# ============================================================
# Metatake downstream 2/4 — CONSOLIDATE (DRY RUN, no writes).
# Reports: dedup merges, sub-gate hubs, and how each oversized
# hub (> 70 figures) would split. Review before the real run.
# Requires: run-mt-embed.command finished first.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Consolidate DRY — $(date)"
python3 mt-consolidate.py
echo
echo "✅ Dry run complete — NOTHING was written."
echo "   Paste the output back to review, then run run-mt-consolidate.command."
echo "Press Enter to close..."; read -r _
