#!/bin/zsh
# Metatake — fetch the hub search-phrase batch and write seo_phrase to meta_takes.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=mt-seo-fetch.log; : > "$LOG"
echo "▶ mt-seo BATCH fetch ($(date))" | tee -a "$LOG"
$PY -u mt-seo-batch.py --fetch 2>&1 | tee -a "$LOG"
echo "✅ Done (or 'not ready' — re-run later)." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
