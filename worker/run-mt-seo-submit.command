#!/bin/zsh
# Metatake — submit hub search-phrase generation as ONE batch (~50% cheaper, async).
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=mt-seo-submit.log; : > "$LOG"
echo "▶ mt-seo BATCH submit ($(date))" | tee -a "$LOG"
$PY -u mt-seo-batch.py --submit 2>&1 | tee -a "$LOG"
echo "✅ Submitted. Later run run-mt-seo-fetch.command." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
