#!/bin/bash
# Keyword Radar — resident watcher (정본: HANDOFF-키워드레이더.md §7.2).
# launchd/cron are TCC-blocked from ~/Documents on this Mac, so this is a
# long-running Terminal-context loop. It (a) keeps the two Node stream
# consumers alive and (b) fires the Python pollers on schedule. GDELT is long
# (~17 min for 100 kw at 10s spacing) so it runs backgrounded under a lock;
# everything else runs inline. Restart after reboot:
#   nohup /Users/jerryje/Documents/MetaTake/radar/radar-watch.sh >/dev/null 2>&1 &
set -u
DIR="/Users/jerryje/Documents/MetaTake/radar"
LOG="$DIR/cron.log"
PIDFILE="$DIR/.watch.pid"
NODE="$HOME/.local/node/bin/node"
PY="/usr/bin/python3"
cd "$DIR" || exit 1
mkdir -p state

# single-instance guard: double-starting must be harmless (duplicate loops
# would double-poll and race the pollers).
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  echo "[$(date -u +%FT%TZ)] radar-watch already running (pid $(cat "$PIDFILE")) — exiting" >> "$LOG"
  exit 0
fi
echo $$ > "$PIDFILE"
echo "[$(date -u +%FT%TZ)] radar-watch started (pid $$)" >> "$LOG"

ts() { date -u +%FT%TZ; }

# keep a resident process alive: $1=pidfile, rest=command
ensure() {
  local pf="$1"; shift
  if [ -f "$pf" ] && kill -0 "$(cat "$pf" 2>/dev/null)" 2>/dev/null; then return; fi
  nohup "$@" >> "$LOG" 2>&1 &
  echo $! > "$pf"
  echo "[$(ts)] started: $*" >> "$LOG"
}

run() { echo "[$(ts)] run $*" >> "$LOG"; $PY "$DIR/$1" "${@:2}" >> "$LOG" 2>&1; }

# background run with an atomic mkdir lock (for the long GDELT sweep)
run_bg() {
  local name="$1"; shift
  local lock="$DIR/.lock_$name"
  # self-heal a stale lock from a hard-killed prior sweep (the EXIT trap doesn't
  # fire on SIGKILL/power-loss/reboot). GDELT tops out ~20 min, so a lock older
  # than 40 min is dead — clear it, else GDELT would be disabled forever.
  if [ -d "$lock" ] && [ -z "$(find "$lock" -maxdepth 0 -mmin -40 2>/dev/null)" ]; then
    rmdir "$lock" 2>/dev/null && echo "[$(ts)] cleared stale lock $name" >> "$LOG"
  fi
  if ! mkdir "$lock" 2>/dev/null; then
    echo "[$(ts)] skip $name (already running)" >> "$LOG"; return
  fi
  ( trap 'rmdir "'"$lock"'" 2>/dev/null' EXIT
    echo "[$(ts)] run(bg) $*" >> "$LOG"
    $PY "$DIR/$1" "${@:2}" >> "$LOG" 2>&1 ) &
}

last_tick=""
last_websub=""
while true; do
  if [ -f "$DIR/HOLD" ]; then sleep 60; continue; fi

  ensure "$DIR/.jetstream.pid" "$NODE" "$DIR/ingest_jetstream.mjs"
  ensure "$DIR/.fedibuzz.pid"  "$NODE" "$DIR/ingest_fedibuzz.mjs"

  M=$(date -u +%M); H=$(date -u +%H); D=$(date -u +%d)
  TICK="$H$M"
  if [ "$TICK" != "$last_tick" ]; then
    last_tick="$TICK"
    # 개인 창작자 발굴 모드: GDELT(순수 뉴스/기관)는 비활성 — 필요 시
    #   run_bg gdelt poll_gdelt.py 를 :05에 되살리면 됨(코드는 유지).
    case "$M" in
      05) run poll_feeds.py; run poll_wpcom.py ;;
      20|35|50) run poll_feeds.py fast ;;                       # Medium 15-min class
      25|55) run poll_letterboxd.py ;;                          # 개인 리뷰어 풀
    esac
    case "$M" in 00|15|30|45) run poll_hn.py; run process_inbox.py ;; esac
    if [ "$M" = "10" ]; then case "$H" in 00|06|12|18) run poll_youtube_search.py ;; esac; fi
    if [ "$M" = "30" ] && [ "$H" = "09" ] && [ "$last_websub" != "$D" ]; then
      run websub_renew.py; last_websub="$D"
    fi
  fi
  sleep 30
done
