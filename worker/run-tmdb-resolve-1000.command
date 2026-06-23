#!/bin/zsh
# Metatake — STEP 1 (1000 batch): attach TMDB ids to the +1000 expansion (DRY).
# Searches TMDB, disambiguates by director, dedupes vs the live films table, writes
# ../metatake_films_expansion_1000_resolved.csv. NO DB writes. Review 'low/unmatched'
# rows, hand-fix Film_TMDB_ID if needed, then run the persist command.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=tmdb-resolve-1000.log; : > "$LOG"
echo "▶ TMDB resolve — DRY, 1000 titles ($(date))" | tee -a "$LOG"
$PY -u tmdb-resolve.py --in ../metatake_films_expansion_1000.csv --out ../metatake_films_expansion_1000_resolved.csv 2>&1 | tee -a "$LOG"
echo "✅ DRY done. Review ../metatake_films_expansion_1000_resolved.csv + 'PROJECTED TOTAL'." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
