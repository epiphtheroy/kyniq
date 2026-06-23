#!/usr/bin/env bash
# Trope formation — Stage 2 PILOT: run the critic gate (Opus) on ~24 sample clusters from
# trope-clusters.json and print the NAMES it gives, so we judge naming quality before the full
# batch over all ~3,610 clusters. No DB writes.
set -uo pipefail
cd "$(dirname "$0")"
PY="$HOME/.metatake-venv/bin/python3"; [ -x "$PY" ] || PY=python3
echo "▶ Trope gate — PILOT (~24 clusters, Opus).  python: $PY"
"$PY" -u trope-form.py gate --pilot "${1:-24}" 2>&1 | tee trope-gate-pilot.log
echo
echo "Review the NAMES. Tell Claude — if good, we run the full batch gate."
echo "Press Enter to close..."; read -r _
