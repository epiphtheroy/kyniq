#!/bin/zsh
# Metatake — STEP 1 (persist): create the NEW film rows from the resolved CSV.
# Reads ../metatake_films_expansion_405_resolved.csv (so run the DRY command first,
# and hand-fix any wrong Film_TMDB_ID there). Upserts NEW films by tmdb_id
# (ignore-duplicates, so re-running is safe). By default only high+medium confidence
# rows are written; low-confidence rows are skipped — add --include-low once you've
# verified them in the CSV.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=tmdb-resolve-persist.log; : > "$LOG"
echo "▶ TMDB resolve — PERSIST new film rows ($(date))" | tee -a "$LOG"
$PY -u tmdb-resolve.py --persist 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Persist done. 'films table now ~ [{count}]' = written." | tee -a "$LOG"
echo "   NEXT: run-tmdb-fetch-all.command (enrich metadata/media for the new films)." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
