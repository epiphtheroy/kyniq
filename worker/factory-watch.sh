#!/usr/bin/env bash
# =============================================================================
# The Film Factory — Mac watcher.
# Polls factory.runs for status='queued' and executes the standalone executor
# (worker/factory.py run). This is what makes the /admin/factory "Run" button
# (or `factory.py queue`) actually run WITHOUT spending any Claude tokens —
# the executor is plain Python and the worker scripts use their own API keys.
#
# Start (survives logout):   nohup bash worker/factory-watch.sh >> factory/logs/watch.log 2>&1 &
# Stop:                      touch factory/.watch-stop     (or kill the pid)
# Interval:                  FACTORY_WATCH_SECS=30 bash worker/factory-watch.sh
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
PY="$(command -v python3)"
SECS="${FACTORY_WATCH_SECS:-30}"
mkdir -p factory/logs

# read SUPABASE_ACCESS_TOKEN from .env.local
SBP="$(grep -E '^SUPABASE_ACCESS_TOKEN=' .env.local | head -1 | cut -d= -f2-)"
REF="jvgarcqrtsmgfimdcwgo"

sql() {  # $1 = SQL; prints raw JSON
  curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $SBP" -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    -d "$(python3 -c 'import json,sys;print(json.dumps({"query":sys.argv[1]}))' "$1")"
}

echo "[factory-watch] started $(date) — polling every ${SECS}s"
while true; do
  if [ -f factory/.watch-stop ]; then
    echo "[factory-watch] stop flag found — exiting $(date)"; rm -f factory/.watch-stop; exit 0
  fi
  # claim the oldest queued run (flip to 'running' atomically so two watchers don't collide)
  RID="$(sql "update factory.runs set status='running', started_at=coalesce(started_at,now())
              where id=(select id from factory.runs where status='queued' order by id limit 1)
              returning id;" | python3 -c 'import json,sys
try:
  d=json.load(sys.stdin); print(d[0]["id"] if d else "")
except Exception: print("")')"
  if [ -n "$RID" ]; then
    echo "[factory-watch] executing run #$RID $(date)"
    "$PY" worker/factory.py run --run "$RID" --yes >> "factory/logs/run-$RID.log" 2>&1
    echo "[factory-watch] run #$RID finished $(date) — see factory/logs/run-$RID.log"
  fi
  sleep "$SECS"
done
