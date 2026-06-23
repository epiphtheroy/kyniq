#!/usr/bin/env bash
# Trope consolidation — DRY (NO database writes). Folds the 935 reading meta-takes
# into the figure_type trope layer and dedups it. Produces a readable plan + cost.
# Uses a private venv (~/.metatake-venv) so numpy installs cleanly on any Mac Python.
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Trope consolidation — DRY (no DB writes). (keys from ../.env.local)"

VENV="$HOME/.metatake-venv"
if [ ! -x "$VENV/bin/python" ]; then
  echo "  creating venv ($VENV) …"
  python3 -m venv "$VENV" || { echo "venv creation failed"; echo "Press Enter to close..."; read -r _; exit 1; }
fi
PY="$VENV/bin/python"
"$PY" -c "import numpy" 2>/dev/null || {
  echo "  installing numpy into venv …"
  "$PY" -m pip install --quiet --disable-pip-version-check numpy || {
    echo "numpy install failed"; echo "Press Enter to close..."; read -r _; exit 1; }
}

"$PY" -u trope-consolidate.py 2>&1 | tee trope-consolidate-dry.log
echo
echo "Open worker/trope-consolidate-dry.md to review. Tell Claude when done."
echo "Press Enter to close..."; read -r _
