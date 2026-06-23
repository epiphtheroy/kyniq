#!/usr/bin/env bash
# Bold-take v13.2 — FULL generation over ALL eligible films (~1,934). NO DB writes.
# RESUMABLE: stop anytime (Ctrl-C or just close the window); re-run this file to
# continue — it skips films already finished. Output: worker/bold-take-full.jsonl
# (one film per line). Est. ~$200-215 total across the whole corpus, several hours.
#   • To run one batch only:    add  --limit 500 --offset 0   (then 500/1000/1500)
#   • To stop at a budget:      add  --max-cost 120
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ Bold-take v13.2 FULL — all eligible films · 14 frameworks · resumable JSONL. (keys from ../.env.local)"
echo "  Stop anytime; re-run to resume. Progress prints every 10 films with running cost."
$PY -u bold-take-gen.py --all --out bold-take-full 2>&1 | tee -a bold-take-full.log
echo
echo "Done or paused. Results so far: worker/bold-take-full.jsonl . Re-run to continue, then tell Claude."
echo "Press Enter to close..."; read -r _
