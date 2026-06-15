#!/bin/zsh
# Metatake — TMDB enrichment for ALL films (migration 0015 + genres/overview backfill).
# Backfills genres, overview, posters/backdrops, trailer, runtime, cert, cast, director
# for every film with a tmdb_id (~565). Idempotent (delete+reinsert AI media).
# This is what fixes "genre = Other" across the catalogue.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=tmdb-fetch-all.log; : > "$LOG"
echo "▶ TMDB fetch — ALL films ($(date))" | tee -a "$LOG"
$PY -u tmdb-fetch.py --persist 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Done. 'PERSIST done: N films, M media, D directors' = written." | tee -a "$LOG"
echo "   Genres/overview/media now populated for all films. No deploy needed (data only)." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
