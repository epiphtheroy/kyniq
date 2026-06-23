#!/bin/zsh
# Metatake — POSTER backfill (PERSIST). Fills poster_path for every film missing it
# (1 TMDB call each, no media churn). Fixes the dark top-left poster on film pages.
# Data-only — no deploy needed; pages re-render with posters within ISR refresh.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=tmdb-poster-backfill.log; : > "$LOG"
echo "▶ POSTER backfill — PERSIST ($(date))" | tee -a "$LOG"
$PY -u tmdb-fetch.py --poster-only --persist 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Done. 'PERSIST done: N updated' = posters written. Reload a film page to see it." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
