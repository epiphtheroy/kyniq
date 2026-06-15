#!/bin/zsh
# ============================================================
# Metatake — figure enrichment FULL BATCH (PERSIST, ALL un-enriched films).
# ⚠ WRITES TO THE DB. Claude Opus 4.8, one call per chunk; ~tens of minutes.
# Idempotent: already-enriched figures (>=3 registers) are skipped automatically.
# Run STAGING first. After this, RUN IT ONCE MORE to fill any partial-matched
# figures, THEN run the downstream pipeline (consolidate -> author -> rank -> recommend).
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=figure-enrich-all.log; : > "$LOG"
echo "▶ Figure enrichment FULL BATCH — PERSIST all films ($(date))" | tee -a "$LOG"
echo "  ⚠ THIS WRITES TO THE DB. Rollback boundary = the timestamp above." | tee -a "$LOG"
$PY -u figure-enrich.py --model claude-opus-4-8 --persist 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Full batch done. Re-run this command ONCE to fill partial-matched figures." | tee -a "$LOG"
echo "   Then downstream: mt-consolidate -> mt-author -> mt-rank -> mt-recommend." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
