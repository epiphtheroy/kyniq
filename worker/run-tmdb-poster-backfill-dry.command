#!/bin/zsh
# Metatake — POSTER backfill (DRY). Lists every film whose poster_path is null and
# what TMDB poster it would set. NO DB writes. The film-page top-left poster shows a
# dark box whenever poster_path is null — this fills it. (root cause: tmdb-fetch never
# wrote poster_path; only backdrop_path. Now fixed + this fast mode added.)
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=tmdb-poster-backfill.log; : > "$LOG"
echo "▶ POSTER backfill — DRY ($(date))" | tee -a "$LOG"
$PY -u tmdb-fetch.py --poster-only 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ DRY done. Review the list, then run run-tmdb-poster-backfill.command to write." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
