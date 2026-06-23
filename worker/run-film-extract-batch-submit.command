#!/bin/zsh
# Metatake — STEP A: submit ALL figure-less films as ONE Anthropic batch (≈50% cheaper).
# Returns immediately and saves the batch id. You can close the laptop afterwards.
# Processing is async (usually < a few hours, max 24h). Then run the FETCH command.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=film-extract-batch-submit.log; : > "$LOG"
echo "▶ film-extract BATCH submit — all figure-less films ($(date))" | tee -a "$LOG"
$PY -u film-extract-batch.py --submit 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Submitted. Note the batch id above. Later: run run-film-extract-batch-fetch.command" | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
