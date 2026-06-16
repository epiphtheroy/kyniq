#!/usr/bin/env bash
# ============================================================
# Metatake — retitle split families (DRY: prints proposed titles, no writes).
# For each split family, the model sees ALL siblings and proposes DISTINCT
# titles + laconics. Review the output, then run run-mt-retitle.command.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Retitle splits DRY — $(date)"
python3 mt-retitle-splits.py
echo
echo "✅ Dry run complete — NOTHING written. Review the proposed titles above,"
echo "   then run run-mt-retitle.command to apply (with essay rewrite)."
echo "Press Enter to close..."; read -r _
