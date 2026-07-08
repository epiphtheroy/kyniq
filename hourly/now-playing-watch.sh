#!/bin/bash
# Now Playing — hourly production watcher.
# Same pattern as auto-deploy-watch.sh: a long-running loop started from a
# Terminal-context shell, because launchd/cron jobs are TCC-blocked from
# reading ~/Documents (observed 2026-07-09: "Operation not permitted" every
# hour). Survives as a background process; restart after reboot:
#   nohup /Users/jerryje/Documents/MetaTake/hourly/now-playing-watch.sh >/dev/null 2>&1 &
set -u
DIR="/Users/jerryje/Documents/MetaTake/hourly"
LOG="$DIR/poller/cron.log"
PIDFILE="$DIR/.watch.pid"
cd "$DIR" || exit 1

# single-instance guard: double-starting (e.g. re-running the nohup line when
# a watcher is already alive) must be harmless — duplicate loops would race
# the daily cap and double-publish.
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  echo "[$(date -u +%FT%TZ)] watcher already running (pid $(cat "$PIDFILE")) — exiting" >> "$LOG"
  exit 0
fi
echo $$ > "$PIDFILE"

echo "[$(date -u +%FT%TZ)] now-playing-watch started (pid $$)" >> "$LOG"

run_once() {
  if [ -f "$DIR/HOLD" ]; then
    echo "[$(date -u +%FT%TZ)] HOLD present — skipping run" >> "$LOG"
    return
  fi
  /usr/bin/python3 "$DIR/pipeline/produce.py" >> "$LOG" 2>&1
}

# one run at start (catches up if the Mac slept through :00), then every :00
run_once
while true; do
  now_min=$(date +%M)
  now_sec=$(date +%S)
  sleep_s=$(( (60 - 10#$now_min) * 60 - 10#$now_sec ))
  [ "$sleep_s" -le 0 ] && sleep_s=60
  sleep "$sleep_s"
  run_once
done
