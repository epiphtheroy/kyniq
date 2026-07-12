#!/bin/bash
# Factory Sentinel — daily self-update watcher (HANDOFF-영화공장.md §11.4).
# Same pattern as hourly/now-playing-watch.sh: a long-running loop started from a
# Terminal-context shell, because launchd/cron jobs are TCC-blocked from reading
# ~/Documents ("Operation not permitted"). Survives as a background process.
#
# One pass ~06:00 UTC daily: git-diff × coupling map, data-drift gaps, schema/RPC
# lint → change orders. Default run mode here is --live (real CO writes); flip to
# report-only by creating factory/HOLD or editing RUN_MODE below.
#
# chmod +x factory-sentinel.sh   (once)
# Start / restart after reboot (run from a Terminal window, NOT cron):
#   nohup /Users/jerryje/Documents/MetaTake/factory-sentinel.sh >/dev/null 2>&1 &
# Stop:      touch /Users/jerryje/Documents/MetaTake/factory/HOLD   (skips the next run)
#            kill "$(cat /Users/jerryje/Documents/MetaTake/factory/.sentinel.pid)"
# P4 bundles this with the 3 news watchers in restart-watchers.command.
set -u
DIR="/Users/jerryje/Documents/MetaTake"
PY="/usr/bin/python3"
SCRIPT="$DIR/worker/factory-sentinel.py"
LOG="$DIR/factory/logs/sentinel-watch.log"
PIDFILE="$DIR/factory/.sentinel.pid"
HOLD="$DIR/factory/HOLD"
RUN_MODE="--live"      # sentinel writes COs / registers intake / advances checkpoint.
RUN_HOUR=6             # daily run hour, UTC.
mkdir -p "$DIR/factory/logs"
cd "$DIR" || exit 1

# single-instance guard: double-starting must be harmless (duplicate loops would
# race the checkpoint advance and double-emit change orders).
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  echo "[$(date -u +%FT%TZ)] sentinel watcher already running (pid $(cat "$PIDFILE")) — exiting" >> "$LOG"
  exit 0
fi
echo $$ > "$PIDFILE"
echo "[$(date -u +%FT%TZ)] factory-sentinel-watch started (pid $$)" >> "$LOG"

run_once() {
  if [ -f "$HOLD" ]; then
    echo "[$(date -u +%FT%TZ)] HOLD present — skipping sentinel run" >> "$LOG"
    return
  fi
  echo "[$(date -u +%FT%TZ)] sentinel run ($RUN_MODE) begin" >> "$LOG"
  "$PY" "$SCRIPT" --once "$RUN_MODE" >> "$LOG" 2>&1
  echo "[$(date -u +%FT%TZ)] sentinel run end (rc=$?)" >> "$LOG"
}

# Sleep until the next RUN_HOUR:00 UTC, then run. One pass/day.
while true; do
  now_h=$(date -u +%H); now_m=$(date -u +%M); now_s=$(date -u +%S)
  # seconds until today's RUN_HOUR:00:00 UTC; if already past, target tomorrow.
  secs_now=$(( 10#$now_h * 3600 + 10#$now_m * 60 + 10#$now_s ))
  target=$(( RUN_HOUR * 3600 ))
  if [ "$secs_now" -ge "$target" ]; then
    sleep_s=$(( 86400 - secs_now + target ))
  else
    sleep_s=$(( target - secs_now ))
  fi
  [ "$sleep_s" -le 0 ] && sleep_s=3600
  sleep "$sleep_s"
  run_once
done
