#!/usr/bin/env bash
# ============================================================
# Metatake — retitle split families (PERSIST + rewrite essays).
# Gives each split sibling a DISTINCT title/laconic and rewrites its
# thesis+essay to match. New unique slugs. Nothing created or moved.
# Run the DRY version first and review the proposed titles.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Retitle splits PERSIST (+essays) — $(date)"
echo "  ⚠ THIS WRITES TO THE DB (titles, laconics, essays, slugs)."
python3 mt-retitle-splits.py --persist --essays
echo
echo "✅ Done. Split siblings now have distinct titles."
echo "Press Enter to close..."; read -r _
