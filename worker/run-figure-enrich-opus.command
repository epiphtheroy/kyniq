#!/bin/zsh
# ============================================================
# Metatake — figure enrichment DRY with CLAUDE OPUS 4.8 (NO DB writes).
# Quality A/B vs the Gemini 3.1 Pro run. 4 fresh stress-test films.
# Requires ANTHROPIC_API_KEY in .env.local. Writes worker/figure-enrich.opus.json.
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=figure-enrich-opus.log; : > "$LOG"
echo "▶ Figure enrichment DRY — Claude Opus 4.8, 4 films ($(date))" | tee -a "$LOG"
$PY -u figure-enrich.py --model claude-opus-4-8 \
  --film three-billboards-outside-ebbing-missouri-2017 \
  --film furiosa-a-mad-max-saga-2024 \
  --film little-women-2019 \
  --film bacurau-2019 \
  --out figure-enrich.opus.json 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ DRY done → worker/figure-enrich.opus.json (NO DB writes). Tell Claude to compare vs Gemini." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
