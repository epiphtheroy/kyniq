#!/usr/bin/env bash
# Bold-take v13 production worker — DRY on the 8-film pilot. NO database writes.
# 13 frameworks (+ PERSONA-PARALLEL, JUXTAPOSITION) + figure augmentation.
# Produces: bold-take-dry-v13.md (readable), bold-take-dry-v13.json (raw), cost estimate.
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ Bold-take v13.3 DRY — 8 films · Cinematic Invitation + 14 frameworks · theory metadata. (keys from ../.env.local)"
$PY -u bold-take-gen.py 2>&1 | tee bold-take-v13.log
echo
echo "Open worker/bold-take-dry-v13.md to review. Tell Claude when done."
echo "Press Enter to close..."; read -r _
