#!/bin/zsh
# ============================================================
# Metatake — figure enrichment STAGING (PERSIST, Claude Opus 4.8, 4 vetted films).
# ⚠ WRITES TO THE DB. These 4 are exactly the films whose Opus DRY output was reviewed.
# Run this, eyeball the DB, then run the full batch. Idempotent (re-run fills gaps).
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=figure-enrich-stage.log; : > "$LOG"
echo "▶ Figure enrichment STAGING — PERSIST 3 vetted films ($(date))" | tee -a "$LOG"
echo "  ⚠ THIS WRITES TO THE DB. Rollback boundary = the timestamp above." | tee -a "$LOG"
$PY -u figure-enrich.py --model claude-opus-4-8 \
  --film bacurau-2019 \
  --film three-billboards-outside-ebbing-missouri-2017 \
  --film little-women-2019 \
  --film furiosa-a-mad-max-saga-2024 \
  --persist 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Staging done. Check the per-film 'PERSIST done: N takes' lines." | tee -a "$LOG"
echo "   If any '⚠ X/Y figures matched', double-click again (idempotent) to fill the rest." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
