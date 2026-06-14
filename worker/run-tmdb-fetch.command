#!/bin/zsh
# Metatake — TMDB enrichment (film metadata + media + directors), migration 0015.
# DEFAULT below = PERSIST for the 2 canary films. For a dry preview, remove --persist.
# After verifying, widen to all films: change to  tmdb-fetch.py --persist
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=tmdb-fetch.log; : > "$LOG"
echo "▶ TMDB fetch — 2 canary films ($(date))" | tee -a "$LOG"
$PY -u tmdb-fetch.py --film forrest-gump-1994 --film the-power-of-the-dog-2021 --persist 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Done. 'PERSIST done: N films, M media, D directors' = written. Deploy to render." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
