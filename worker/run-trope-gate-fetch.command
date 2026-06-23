#!/usr/bin/env bash
# Trope gate — FETCH results (re-run until all batches report ended), then finalize → trope-plan.json.
set -uo pipefail
cd "$(dirname "$0")"
PY="$HOME/.metatake-venv/bin/python3"; [ -x "$PY" ] || PY=python3
echo "▶ Trope gate — FETCH results.  python: $PY"
"$PY" -u trope-gate-batch.py fetch 2>&1 | tee -a trope-gate-fetch.log
echo
if grep -q "all batches ended" trope-gate-fetch.log 2>/dev/null; then
  echo "▶ All ended — running finalize…"
  "$PY" -u trope-form.py finalize 2>&1 | tee trope-finalize.log
fi
echo "Press Enter to close..."; read -r _
