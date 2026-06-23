#!/usr/bin/env bash
# Bold-take FULL via Anthropic Batch API (~50% cheaper). STEP 1 of 2: build + submit.
# Builds one request per eligible film (skips any already in bold-take-full.jsonl),
# then submits them as batch(es). Batches process asynchronously (minutes–hours).
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ Batch SUBMIT — emit requests for all eligible films, then submit to Anthropic Batch API (~50% cost)."
$PY -u bold-take-gen.py --emit-requests --all --out bold-take-full 2>&1 | tee -a bold-take-batch.log
$PY -u bold-take-batch.py submit --out bold-take-full 2>&1 | tee -a bold-take-batch.log
echo
echo "Submitted. Batches run async. Later, run run-bold-take-batch-fetch.command (re-run until all 'ended')."
echo "Press Enter to close..."; read -r _
