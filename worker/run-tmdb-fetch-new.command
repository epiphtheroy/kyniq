#!/bin/zsh
# Metatake — TMDB enrichment for NEW films ONLY (the 400 just added).
# --missing = only films with no overview yet, so the working 565 are left untouched.
# Fills overview/genres/cast/runtime/cert + posters/backdrops/trailer + director profiles.
# Idempotent. Needs TMDB_READ_TOKEN in worker/.env.local. No deploy (data only).
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=tmdb-fetch-new.log; : > "$LOG"
echo "▶ TMDB fetch — NEW films only (--missing) ($(date))" | tee -a "$LOG"
$PY -u tmdb-fetch.py --persist --missing 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Done. overview/genres/media filled for the new films." | tee -a "$LOG"
echo "   NEXT: run-film-extract.command (generate figures+takes for them)." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
