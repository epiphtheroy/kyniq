#!/bin/zsh
# FilmCurio — Frame approve + editorial ranking.
# Double-click: approves and ranks EVERY candidate frame that passes the
# hub gate (>=5 published instances).
# Single frame:  python3 frame-rank.py --slug <slug> [--approve]
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
$PY frame-rank.py --all-gated 2>&1 | tee frame-rank.log
echo; echo "Press Enter to close..."; read -r _
