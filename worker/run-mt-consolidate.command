#!/usr/bin/env bash
# ============================================================
# Metatake downstream 2/4 — CONSOLIDATE (PERSIST — WRITES TO DB).
# Dedups near-duplicate hubs and splits every hub > 70 figures
# into semantic sub-hubs. Run the DRY version first and review.
# Re-runnable (idempotent-ish: deduped/split hubs won't change again).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Consolidate PERSIST — $(date)"
echo "  ⚠ THIS WRITES TO THE DB."
python3 mt-consolidate.py --persist
echo
echo "✅ Consolidate done."
echo "   Next: run-mt-author.command (then rank, recommend)."
echo "Press Enter to close..."; read -r _
