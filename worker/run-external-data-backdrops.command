#!/bin/zsh
# Metatake — backfill films.backdrop_path (+poster_path if missing) for films that have none.
# 1 TMDB call per film, no OMDb. Fills the big hero background image on catalog film pages.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=external-data-backdrops.log; : > "$LOG"
echo "▶ external-data BACKDROPS backfill ($(date))" | tee -a "$LOG"
$PY -u external-data.py --persist --backdrops 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Done. Backdrops filled. Live within ISR (~5 min). No deploy needed (data only)." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
