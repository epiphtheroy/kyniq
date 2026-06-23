#!/usr/bin/env bash
# Trope gate — EMIT: build the batch requests (small clusters whole; big clusters k-means
# pre-split) + the custom_id→take_ids map. Prints request count + cost estimate. No writes/LLM.
set -uo pipefail
cd "$(dirname "$0")"
PY="$HOME/.metatake-venv/bin/python3"; [ -x "$PY" ] || PY=python3
echo "▶ Trope gate — EMIT requests.  python: $PY"
"$PY" -u trope-form.py emit 2>&1 | tee trope-gate-emit.log
echo; echo "If the count/cost look right, run run-trope-gate-submit.command."
echo "Press Enter to close..."; read -r _
