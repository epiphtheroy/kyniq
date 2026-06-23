#!/usr/bin/env bash
# APPLY the reviewed trope-consolidation plan (writes DB). Reversible: readings are
# RETIRED (not deleted); full snapshot in _bak_consol_meta_takes / _bak_consol_ftm.
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ APPLY trope consolidation — writes DB (reversible). Reads trope-consolidate-dry.json."
PY=/usr/bin/python3; command -v "$PY" >/dev/null 2>&1 || PY=python3
"$PY" -u trope-consolidate-apply.py 2>&1 | tee trope-consolidate-apply.log
echo
echo "Done. Tell Claude to verify + run the app redirects."
echo "Press Enter to close..."; read -r _
