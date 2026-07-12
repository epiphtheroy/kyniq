#!/bin/bash
# ============================================================
# The Film Factory — intake watcher (planning loop).
#
# Long-running loop started from a Terminal-context shell, NOT launchd/cron:
# launchd/cron jobs are TCC-blocked from reading ~/Documents (observed:
# "Operation not permitted"). Survives as a background process.
#
# What it does: every ~300s, if there is queued intake in factory.intake,
# it runs `factory.py plan` to (re)compute the proposed stage plan. It does
# NOT execute stages or spend money — running the plan is the owner's call
# (double-click run-factory-run.command). This just keeps the plan warm and
# surfaces new intake.
#
# Restart after reboot (from a Terminal window, not launchd):
#   nohup /Users/jerryje/Documents/MetaTake/factory-watch.sh >/dev/null 2>&1 &
#
# Pause:  touch  /Users/jerryje/Documents/MetaTake/factory/HOLD
# Resume: rm     /Users/jerryje/Documents/MetaTake/factory/HOLD
# Stop:   kill "$(cat /Users/jerryje/Documents/MetaTake/factory/.watch.pid)"
# ============================================================
set -u
REPO="/Users/jerryje/Documents/MetaTake"
DIR="$REPO/factory"
LOG="$DIR/watch.log"
PIDFILE="$DIR/.watch.pid"
HOLD="$DIR/HOLD"
SLEEP_S=300
cd "$REPO" || exit 1
mkdir -p "$DIR"

# single-instance guard: re-running the nohup line while a watcher is alive
# must be harmless (duplicate loops would double-plan).
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  echo "[$(date -u +%FT%TZ)] factory-watch already running (pid $(cat "$PIDFILE")) — exiting" >> "$LOG"
  exit 0
fi
echo $$ > "$PIDFILE"
echo "[$(date -u +%FT%TZ)] factory-watch started (pid $$)" >> "$LOG"

run_once() {
  if [ -f "$HOLD" ]; then
    echo "[$(date -u +%FT%TZ)] HOLD present — skipping" >> "$LOG"
    return
  fi
  echo "[$(date -u +%FT%TZ)] plan" >> "$LOG"
  python3 worker/factory.py plan >> "$LOG" 2>&1
}

run_once
while true; do
  sleep "$SLEEP_S"
  run_once
done
