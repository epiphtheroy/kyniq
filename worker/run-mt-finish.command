#!/bin/zsh
# ============================================================
# Metatake downstream 3/4 — FINISH: author → rank → recommend.
# Run AFTER run-mt-consolidate.command (persist) has completed.
#   - author    : write title/laconic/thesis/essay for candidate hubs
#                 (>=5 films) and publish them. Re-runnable (un-authored only).
#   - rank      : relevance + surprise per take (defining / unexpected kin).
#   - recommend : film affinities ("kin" films).
# Logs to worker/mt-finish.log. Stops on first failure (each step is idempotent).
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=mt-finish.log; : > "$LOG"
setopt PIPE_FAIL 2>/dev/null || true
step () {
  echo "" | tee -a "$LOG"; echo "════════ $1 ════════" | tee -a "$LOG"
  $PY "$2" "${@:3}" 2>&1 | tee -a "$LOG"
  if [ "${pipestatus[1]}" != "0" ]; then
    echo "✗ FAILED at $1 — stopping. See $LOG (each script is idempotent; just re-run this)." | tee -a "$LOG"; exit 1
  fi
}
echo "▶ Metatake finish starting ($(date))" | tee -a "$LOG"
step "1/3 author (titles, essays, publish ≥5-film hubs)"  mt-author.py
step "2/3 rank (relevance + surprise)"  mt-rank.py
step "3/3 recommend (film affinities)"  mt-recommend.py
echo "" | tee -a "$LOG"
echo "✅ Finish complete. Verify, then flip SITE_INDEXABLE and deploy." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
