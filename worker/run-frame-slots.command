#!/bin/zsh
# FilmCurio — Frame slot filling. Double-click to run.
# Fills slot values for all approved frames' instances → activates the
# "for writers" craft block on /frame/[slug] hub pages. Data-only.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
$PY frame-slots.py "$@" 2>&1 | tee frame-slots.log
echo; echo "Press Enter to close..."; read -r _
