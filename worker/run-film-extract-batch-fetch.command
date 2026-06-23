#!/bin/zsh
# Metatake — STEP B: fetch the batch results and write figures+takes to the DB.
# Run this any time after submitting. If the batch isn't finished yet, it just tells
# you to try again later (safe to run repeatedly). Idempotent: skips films that already
# have figures. To preview WITHOUT writing to the DB, add --dry inside this file.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=film-extract-batch-fetch.log; : > "$LOG"
echo "▶ film-extract BATCH fetch ($(date))" | tee -a "$LOG"
$PY -u film-extract-batch.py --fetch 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Done (or 'not ready' — re-run later). Tell me; I'll verify counts." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
