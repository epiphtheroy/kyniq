#!/usr/bin/env bash
# Bold-take LOAD — DRY (NO database writes). Resolves each Strong Misreading's figure
# anchor against the live DB, plans per-film title/film figures + any new-label figures,
# normalizes frameworks, and writes a deterministic plan (boldtake-load-plan.json) + report.
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ Bold-take LOAD — DRY (no DB writes)."
$PY -u boldtake-load.py 2>&1 | tee boldtake-load-dry.log
echo
echo "Review the plan (anchor match rate · figures to create · framework dist). Tell Claude."
echo "Press Enter to close..."; read -r _
