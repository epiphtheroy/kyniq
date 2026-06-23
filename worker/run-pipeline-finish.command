#!/bin/zsh
# ============================================================
# Metatake — FINISH pipeline (P6b → P8), one double-click, walk away.
# Fire this NOW even while trope-tag is still running: it WAITS for trope-tag to
# settle, then runs the rest and STOPS before the supervised P9.
#
#   P0  wait        — poll figure_tags until trope-tag stops writing (~3 min quiet)
#   P6b trope-build — cluster tags → name → create trope hubs (--reset, Opus naming)
#   P8  SEO         — submit the hub search-phrase batch (Anthropic Batch API, async),
#                     then poll fetch (~up to 25 min) and write seo_phrase
#
# (P7 theory/tradition is already satisfied: the canon is loaded and matching runs
#  at author time, which P5a already did. Nothing to run here.)
#
# DELIBERATELY STOPS before P9 (integrity + un-hold ~1,000 films + deploy) — that
# one is supervised: tell Claude when this finishes. Every step is idempotent;
# if anything fails, fix and just re-run this file. Log: worker/pipeline-finish.log
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=pipeline-finish.log; : > "$LOG"
setopt PIPE_FAIL 2>/dev/null || true
step () {
  echo "" | tee -a "$LOG"; echo "════════ $1  ($(date +%H:%M:%S)) ════════" | tee -a "$LOG"
  $PY "$2" "${@:3}" 2>&1 | tee -a "$LOG"
  if [ "${pipestatus[1]}" != "0" ]; then
    echo "✗ FAILED at: $1 — stopping. See $LOG. Idempotent; fix and re-run this file." | tee -a "$LOG"
    echo "Press Enter to close..."; read -r _; exit 1
  fi
}
echo "▶ Metatake FINISH pipeline (P6b → P8; stops before P9)  ($(date))" | tee -a "$LOG"

echo "" | tee -a "$LOG"; echo "════════ P0  wait for trope-tag to settle  ($(date +%H:%M:%S)) ════════" | tee -a "$LOG"
$PY pipeline-wait-tropetag.py 2>&1 | tee -a "$LOG"

step "P6b trope-build (cluster → name → hubs, --reset)" trope-build.py --persist --reset

echo "" | tee -a "$LOG"; echo "════════ P8a SEO submit (Anthropic batch, async)  ($(date +%H:%M:%S)) ════════" | tee -a "$LOG"
$PY -u mt-seo-batch.py --submit 2>&1 | tee -a "$LOG"
if [ "${pipestatus[1]}" != "0" ]; then echo "✗ SEO submit failed — see log. (trope-build already done.)" | tee -a "$LOG"; echo "Press Enter to close..."; read -r _; exit 1; fi

echo "" | tee -a "$LOG"; echo "════════ P8b SEO fetch (poll up to ~25 min)  ($(date +%H:%M:%S)) ════════" | tee -a "$LOG"
seo_done=0
for i in $(seq 1 12); do
  out="$($PY -u mt-seo-batch.py --fetch 2>&1)"; echo "$out" | tee -a "$LOG"
  if echo "$out" | grep -q "Wrote seo_phrase"; then seo_done=1; break; fi
  echo "  …SEO batch still processing; waiting 120s ($i/12)" | tee -a "$LOG"; sleep 120
done
if [ "$seo_done" = "1" ]; then echo "✅ SEO phrases written." | tee -a "$LOG"
else echo "ℹ️ SEO batch not finished within the window — run worker/run-mt-seo-fetch.command later (or tell Claude)." | tee -a "$LOG"; fi

echo "" | tee -a "$LOG"
echo "✅ P6–P8 complete (SEO may still be finishing).  ($(date))" | tee -a "$LOG"
echo "   NEXT — supervised, tell Claude: P9 integrity + un-hold ~1,000 expansion films + deploy." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
