#!/bin/zsh
# Metatake — STEP 1 (1000 batch, persist): create the NEW film rows from the resolved CSV.
# Reads ../metatake_films_expansion_1000_resolved.csv (run DRY first; hand-fix wrong ids).
# Upserts NEW films by tmdb_id (ignore-duplicates). high+medium only unless --include-low.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=tmdb-resolve-1000-persist.log; : > "$LOG"
echo "▶ TMDB resolve — PERSIST 1000 new film rows ($(date))" | tee -a "$LOG"
$PY -u tmdb-resolve.py --persist --in ../metatake_films_expansion_1000_resolved.csv --out ../metatake_films_expansion_1000_resolved.csv 2>&1 | tee -a "$LOG"
echo "✅ Persist done. NEXT: run-tmdb-fetch-new.command (metadata for the new films)." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
