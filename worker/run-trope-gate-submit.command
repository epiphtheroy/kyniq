#!/usr/bin/env bash
# Trope gate — SUBMIT the requests to the Anthropic Batches API (~50% cost). Resumable.
set -uo pipefail
cd "$(dirname "$0")"
PY="$HOME/.metatake-venv/bin/python3"; [ -x "$PY" ] || PY=python3
echo "▶ Trope gate — SUBMIT batch.  python: $PY"
"$PY" -u trope-gate-batch.py submit 2>&1 | tee -a trope-gate-submit.log
echo; echo "Processing is async (minutes–1h+). Later run run-trope-gate-fetch.command."
echo "Press Enter to close..."; read -r _
