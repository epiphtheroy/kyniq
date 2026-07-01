#!/bin/zsh
# DRY: preview clip search for 8 films (no DB writes). Writes worker/film-clips-dry.md.
# Needs YOUTUBE_API_KEY (or YOUTUBE_DATA_API_KEY) in .env.local. Uses ~200 YouTube units/film.
cd "$(dirname "$0")/worker"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
$PY -u film-clips.py --limit 8
echo ""
echo "Press Enter to close..."; read -r _
