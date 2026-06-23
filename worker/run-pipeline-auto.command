#!/bin/zsh
# ============================================================
# Metatake — AUTONOMOUS pipeline (P3 → P5), one double-click.
# Chains the SAFE, idempotent remainder of the post-batch pipeline and runs it
# unattended:  embeddings → consolidate(persist) → author → rank → recommend.
# Stops on the first failure (every step is idempotent — fix and just re-run this file).
#
# DELIBERATELY STOPS before the destructive / irreversible steps, which need a
# supervised run (tell Claude): P6 trope-tag → trope-build (--reset wipes trope hubs),
# P7 theory match, P8 SEO intros, P9 integrity + un-hold expansion + deploy.
#
# SELF-WAITING: step P0 polls the DB and waits until the batch-B fetch stops writing
#         (quiet > 3 min) before starting — so you can double-click this NOW, even while
#         the batch is still running, and walk away. It will wait, then run everything.
# Log: worker/pipeline-auto.log
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=pipeline-auto.log; : > "$LOG"
setopt PIPE_FAIL 2>/dev/null || true
step () {
  echo "" | tee -a "$LOG"; echo "════════ $1  ($(date +%H:%M:%S)) ════════" | tee -a "$LOG"
  $PY "$2" "${@:3}" 2>&1 | tee -a "$LOG"
  if [ "${pipestatus[1]}" != "0" ]; then
    echo "✗ FAILED at: $1 — stopping. See $LOG. Every step is idempotent; fix and re-run this file." | tee -a "$LOG"
    echo "Press Enter to close..."; read -r _; exit 1
  fi
}
echo "▶ Metatake AUTONOMOUS pipeline starting ($(date))" | tee -a "$LOG"
echo "" | tee -a "$LOG"; echo "════════ P0  wait for batch-fetch to settle  ($(date +%H:%M:%S)) ════════" | tee -a "$LOG"
$PY pipeline-wait-batch.py 2>&1 | tee -a "$LOG"
step "P3  embeddings (takes/figures/hubs, null-only)"      mt-embed.py
step "P4  consolidate (dedup + split oversized, PERSIST)"  mt-consolidate.py --persist
step "P5a author (titles/essays, publish >=5-film hubs)"   mt-author.py
step "P5b rank (relevance + surprise)"                     mt-rank.py
step "P5c recommend (film affinities / kin films)"         mt-recommend.py
echo "" | tee -a "$LOG"
echo "✅ AUTONOMOUS pipeline complete ($(date))." | tee -a "$LOG"
echo "   Remaining (supervised — tell Claude): P6 trope-tag→build, P7 theory match," | tee -a "$LOG"
echo "   P8 SEO intros, P9 integrity + un-hold expansion + deploy." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
