#!/bin/zsh
# ============================================================
# FilmCurio / Metatake — full data build (steps 2–4).
# Double-click AFTER applying supabase/migrations/0013_metatake.sql.
# Runs: import → consolidate → author → rank → recommend, in order.
# Each step logs to worker/mt-build.log. Stops on first failure.
# Requires OPENAI_API_KEY + GEMINI_API_KEY + Supabase service key in .env.local.
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=mt-build.log; : > "$LOG"

setopt PIPE_FAIL 2>/dev/null || true
step () {
  echo "" | tee -a "$LOG"
  echo "════════ $1 ════════" | tee -a "$LOG"
  $PY "$2" "${@:3}" 2>&1 | tee -a "$LOG"
  if [ "${pipestatus[1]}" != "0" ]; then
    echo "✗ FAILED at $1 — stopping. See $LOG (rerun that one script, all are idempotent)." | tee -a "$LOG"; exit 1
  fi
}

echo "▶ Metatake build starting ($(date))" | tee -a "$LOG"
step "1/6 import (567 films, figures, takes)"  mt-import.py
step "2/6 clean (house voice, drop scholar names + 'Target Object')"  mt-clean.py
step "3/6 consolidate (meta takes from concepts)"  mt-consolidate.py
step "4/6 author (titles, essays, publish)"  mt-author.py
step "5/6 rank (relevance + surprise)"  mt-rank.py
step "6/6 recommend (film affinities)"  mt-recommend.py

echo "" | tee -a "$LOG"
echo "✅ Build complete. Deploy the app (deploy-metatake.command) to see it live." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
