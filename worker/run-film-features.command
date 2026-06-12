#!/bin/zsh
# FilmCurio — Film features generator (pitch/record/reception/experience).
# Double-click: generates the 4 fixed sections for up to 15 films that
# have published Q&A. Requires migration 0012_film_features.sql first.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
$PY film-features.py "$@" 2>&1 | tee film-features.log
echo; echo "Press Enter to close..."; read -r _
