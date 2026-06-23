#!/bin/zsh
# ============================================================
# Metatake — RESUME the pipeline from P5b (author already done).
# Runs ONLY rank → recommend, so it does NOT re-run embed / consolidate / author.
#   • mt-rank.py      now paginates the meta_takes fetch (30/page) + deletes per
#                     meta-take — fixes the 8s statement-timeout that stopped P5b.
#   • mt-recommend.py now replaces film_affinities per-film (no giant global DELETE).
# Both idempotent — safe to re-run. Log: worker/rank-recommend.log
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=rank-recommend.log; : > "$LOG"
setopt PIPE_FAIL 2>/dev/null || true
step () {
  echo "" | tee -a "$LOG"; echo "════════ $1  ($(date +%H:%M:%S)) ════════" | tee -a "$LOG"
  $PY "$2" "${@:3}" 2>&1 | tee -a "$LOG"
  if [ "${pipestatus[1]}" != "0" ]; then
    echo "✗ FAILED at: $1 — stopping. See $LOG. Idempotent; fix and re-run." | tee -a "$LOG"
    echo "Press Enter to close..."; read -r _; exit 1
  fi
}
echo "▶ Resume rank → recommend ($(date))" | tee -a "$LOG"
step "P5b rank (relevance + surprise)"            mt-rank.py
step "P5c recommend (film affinities / kin films)" mt-recommend.py
echo "" | tee -a "$LOG"
echo "✅ rank + recommend complete ($(date))." | tee -a "$LOG"
echo "   Remaining (supervised — tell Claude): P6 trope-tag→build, P7 theory, P8 SEO intros, P9 un-hold+deploy." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
