#!/bin/bash
# Off-peak, one-shot ko title backfill — finishes the `--refill` tail (the t–z
# films the interactive run didn't reach) at night, away from peak traffic.
#
# WHY off-peak only: the 2026-07-17 DB-saturation incident showed a mass backfill
# during peak (thousands of writes + crawl waves) can pin the small Supabase tier.
# The worker now skips no-op writes, but we still fire this only inside 01:00–05:59
# local. The hour is re-checked in a loop, so if the Mac slept through 03:00 and
# wakes at midday this NEVER runs in daytime — it waits for the next off-peak window.
#
# HOW to run (owner, once — the write needs .env.local's service-role key, so it
# runs as an OS process, not inside the agent sandbox):
#   nohup bash worker/night-refill.sh >/dev/null 2>&1 &
# It backgrounds, waits for the window, runs once, appends to worker/night-refill.log,
# and exits. Check progress:  tail -f worker/night-refill.log
#
# The Mac must be on (plugged in, not shut down) for it to fire.

cd "$(dirname "$0")/.." || exit 1
LOG="worker/night-refill.log"
LOCK="worker/.night-refill.lock"

# Single-instance guard: if a live copy is already waiting/running, don't stack.
if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
  echo "=== $(date) another night-refill already active (pid $(cat "$LOCK")); exiting ===" >> "$LOG"
  exit 0
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

echo "=== $(date) armed — waiting for the 01:00–05:59 off-peak window ===" >> "$LOG"
# Wait until we're inside the off-peak window. Re-check every 20 min so a
# sleep/wake can never drop the run into daytime.
while :; do
  h=$(date +%H)
  if [ "$h" -ge 1 ] && [ "$h" -lt 6 ]; then break; fi
  sleep 1200
done

echo "=== $(date) START  ko --refill --persist ===" >> "$LOG"
python3 worker/tmdb-i18n-backfill.py --locale ko --refill --persist >> "$LOG" 2>&1
echo "=== $(date) DONE (exit $?) ===" >> "$LOG"
