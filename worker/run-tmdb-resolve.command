#!/bin/zsh
# Metatake — STEP 1 of the +405 big bang: attach TMDB ids to the expansion list.
# DRY (default): searches TMDB by title, disambiguates by DIRECTOR, dedupes against
# the live films table, and writes  ../metatake_films_expansion_405_resolved.csv
# It writes NOTHING to the database. Open the resolved CSV and eyeball the rows
# flagged "low" / "unmatched" (printed at the end); hand-fix Film_TMDB_ID if any
# are wrong, save, then double-click run-tmdb-resolve-persist.command.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=tmdb-resolve.log; : > "$LOG"
echo "▶ TMDB resolve — DRY, all 405 titles ($(date))" | tee -a "$LOG"
echo "  (smoke-test first? edit this file: add  --limit 10 )" | tee -a "$LOG"
$PY -u tmdb-resolve.py --in ../metatake_films_expansion_405.csv --out ../metatake_films_expansion_405_resolved.csv 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ DRY done. Review ../metatake_films_expansion_405_resolved.csv —" | tee -a "$LOG"
echo "   check 'PROJECTED TOTAL' and the REVIEW list above. No DB changes were made." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
