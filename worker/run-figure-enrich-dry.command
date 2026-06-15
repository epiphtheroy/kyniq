#!/bin/zsh
# ============================================================
# Metatake — figure enrichment DRY RUN (NO DB writes) to vet the NEW prompt
# before the full 500 batch. 3 stress-test films:
#   • Silence of the Lambs — must NOT default to all-psychoanalytic
#   • They Live           — must NOT default to all-ideological
#   • Drive My Car        — range (formal / existential / form)
# Writes worker/figure-enrich.dry.json for review. Gemini 3.1 Pro, no --persist.
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=figure-enrich-dry.log; : > "$LOG"
echo "▶ Figure enrichment DRY (no DB writes) — new prompt, 3 sample films ($(date))" | tee -a "$LOG"
$PY -u figure-enrich.py \
  --film the-silence-of-the-lambs-1991 \
  --film they-live-1988 \
  --film drive-my-car-2021 \
  --out figure-enrich.dry.json 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ DRY done → worker/figure-enrich.dry.json (NO DB writes)." | tee -a "$LOG"
echo "   Tell Claude it's done; it will read the bundle and give a go/no-go." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
