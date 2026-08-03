#!/bin/bash
# Now Playing — hourly production watcher.
# Same pattern as auto-deploy-watch.sh: a long-running loop started from a
# Terminal-context shell, because launchd/cron jobs are TCC-blocked from
# reading ~/Documents (observed 2026-07-09: "Operation not permitted" every
# hour). Survives as a background process; restart after reboot:
#   nohup /Users/jerryje/Developer/MetaTake/hourly/now-playing-watch.sh >/dev/null 2>&1 &
#
# 2026-08-03: repointed from ~/Documents/MetaTake to ~/Developer/MetaTake. The
# repo moved on 07-29 and this hardcoded path is why publishing stopped that
# day (last piece: 07-29 09:01 UTC). ~/Developer is NOT a TCC-protected
# location, so launchd would work here too — kept as a watcher because that is
# the proven path.
set -u
DIR="/Users/jerryje/Developer/MetaTake/hourly"
# The pipeline shells out to `claude -p` (subscription tokens, not the API
# key), so the CLI must be resolvable even under a minimal nohup environment.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
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
  # The daily digest (23:xx UTC close) is now triggered INSIDE produce.py
  # (_maybe_run_digest), not here. Reason: bash parses this run_once once at
  # startup, so editing this file after the watcher launched never took effect
  # and the digest never ran (2026-07-10). produce.py is re-read every hour, so
  # the trigger fires reliably from there regardless of this process's age.
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
