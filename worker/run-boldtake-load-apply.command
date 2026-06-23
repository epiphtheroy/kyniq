#!/usr/bin/env bash
# Bold-take LOAD — APPLY (WRITES to the live DB). Consumes boldtake-load-plan.json (the file
# you reviewed in DRY). A snapshot (_bak_boldtake_*) was taken before any writes, so this is
# reversible. Preflight aborts if it detects the load was already applied.
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "⚠️  Bold-take LOAD — APPLY (writes to the live database)."
echo "   • insert ~3,974 figures (film/title/new-label)"
echo "   • insert ~26,975 Strong Misreadings (incl. 1,934 invitations)"
echo "   • archive ~46,503 old serial takes  →  status 'retired' (kept, not deleted)"
echo "   Snapshot _bak_boldtake_* already exists → reversible."
echo
read -r -p "Type YES to proceed (anything else aborts): " ans
[ "$ans" = "YES" ] || { echo "Aborted."; echo "Press Enter to close..."; read -r _; exit 1; }
echo
$PY -u boldtake-load.py --apply 2>&1 | tee boldtake-load-apply.log
echo
echo "Done. Tell Claude to verify (figure/take counts, framework dist, a live film page)."
echo "Press Enter to close..."; read -r _
