#!/usr/bin/env bash
# Bold-take FULL via Anthropic Batch API. STEP 2 of 2: fetch results.
# Polls each submitted batch; for any that have ENDED, downloads results and appends
# parsed {slug, invitation, takes} to bold-take-full.jsonl. Safe to re-run: it skips
# films already saved, and reports any batches still processing.
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ Batch FETCH — poll batches; download finished results into bold-take-full.jsonl."
$PY -u bold-take-batch.py fetch --out bold-take-full 2>&1 | tee -a bold-take-batch.log
echo
echo "If any batch is still 'in_progress', re-run this later. Tell Claude when all are done."
echo "Press Enter to close..."; read -r _
