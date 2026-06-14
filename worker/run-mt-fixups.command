#!/bin/zsh
# ============================================================
# FilmCurio / Metatake — FIXUPS (run AFTER the main build).
# The first build's Gemini calls hit a thinking-model token bug:
#   • author published 112/116 meta takes (4 truncated)
#   • clean rewrote only 167/4467 take rationales (rest truncated)
# mt-author.py and mt-clean.py are now fixed (thinkingBudget:0 disables
# thinking so the JSON output isn't truncated; smaller batches + retry).
# This re-runs the fixed steps and refreshes ranking/recommend:
#   author (4 remaining) -> clean (~4300) -> rank -> recommend
# All steps are idempotent / re-run-safe. Logs to worker/mt-fixups.log.
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=mt-fixups.log; : > "$LOG"

setopt PIPE_FAIL 2>/dev/null || true
step () {
  echo "" | tee -a "$LOG"
  echo "════════ $1 ════════" | tee -a "$LOG"
  $PY "$2" "${@:3}" 2>&1 | tee -a "$LOG"
  if [ "${pipestatus[1]}" != "0" ]; then
    echo "✗ FAILED at $1 — stopping. See $LOG (rerun that one script, all are idempotent)." | tee -a "$LOG"; exit 1
  fi
}

echo "▶ Metatake fixups starting ($(date))" | tee -a "$LOG"
step "1/4 author (publish the 4 remaining candidates)"  mt-author.py
step "2/4 clean (house voice — now thinking-disabled, ~4300 takes)"  mt-clean.py
step "3/4 rank (relevance + surprise, refreshed on cleaned text)"  mt-rank.py
step "4/4 recommend (film affinities, refreshed)"  mt-recommend.py

echo "" | tee -a "$LOG"
echo "✅ Fixups complete. The take rationales are now clean house voice and all" | tee -a "$LOG"
echo "   eligible meta takes are published. Reload the site to see the change." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
