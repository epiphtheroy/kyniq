#!/usr/bin/env bash
# Trope persist — DRY (no DB writes). Resolves slugs/members/edges from trope-plan-harmonized.json
# and prints exactly what APPLY would write.
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ Trope persist — DRY (no writes)."
$PY -u trope-persist.py 2>&1 | tee trope-persist-dry.log
echo; echo "Review counts, then run run-trope-persist-apply.command."
echo "Press Enter to close..."; read -r _
