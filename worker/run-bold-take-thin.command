#!/usr/bin/env bash
# Bold-take v13.1 — figure-augmentation check on 3 figure-SPARSE films.
# Goal: confirm the worker proposes new_figures / figure_edits when a film's existing
# figure set is thin (the 8-film pilot was figure-rich, so it proposed 0).
# Output: bold-take-thin.md / .json (does NOT touch the v13.1 review file).
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ Bold-take v13.1 — augmentation check on 3 thin films (Moon · Battle Royale · Architecture 101)."
$PY -u bold-take-gen.py --films moon-2009,battle-royale-2000,architecture-101-2012 --out bold-take-thin 2>&1 | tee bold-take-thin.log
echo
echo "Open worker/bold-take-thin.md to review (look for 'new figs' / 'proposed new figures'). Tell Claude when done."
echo "Press Enter to close..."; read -r _
