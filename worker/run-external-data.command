#!/bin/zsh
# Metatake — external data PERSIST: ALL films with a tmdb_id (~6,701).
# Writes film_watch_providers (TMDB, all countries) + film_ratings (OMDb) + backfills films.imdb_id.
# Resumable: re-running skips films already fetched. Needs OMDB_API_KEY in worker/.env.local.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=external-data.log; : > "$LOG"
echo "▶ external-data PERSIST — ALL films ($(date))" | tee -a "$LOG"
$PY -u external-data.py --persist 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Done. Ratings + watch channels written. Live within ISR (~5 min). No deploy needed (data only)." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
