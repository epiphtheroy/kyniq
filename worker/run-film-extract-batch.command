#!/bin/zsh
# Metatake — film-extract CANARY (PERSIST, first 15 films). Exercises the real DB-write
# path (figures + takes + candidate meta_takes) on a small batch BEFORE the full 400, so
# any persist bug surfaces cheaply. Idempotent: re-running continues with the next films.
# After this, verify, then run run-film-extract.command for the rest. Model: Opus 4.8.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=film-extract-batch.log; : > "$LOG"
echo "▶ film-extract CANARY — PERSIST first 15 films ($(date))" | tee -a "$LOG"
$PY -u film-extract.py --persist --limit 15 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Canary done. Tell me — I'll verify the writes landed before the full run." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
