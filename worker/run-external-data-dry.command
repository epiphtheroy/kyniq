#!/bin/zsh
# Metatake — external data DRY: sample 6 films, fetch TMDB providers + OMDb ratings, print, NO writes.
# Needs worker/.env.local: TMDB_READ_TOKEN (have) + OMDB_API_KEY (add your OMDb key).
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=external-data-dry.log; : > "$LOG"
echo "▶ external-data DRY ($(date))" | tee -a "$LOG"
$PY -u external-data.py 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ DRY done. If it looks good → run-external-data.command (writes)." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
