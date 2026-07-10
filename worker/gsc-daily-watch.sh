#!/usr/bin/env bash
# GSC daily pull — keeps mt_gsc_daily fresh for /admin/metrics.
# Pulls a 3-day window once a day (GSC data lags ~2 days, so the window
# re-covers days as they finalize). Same nohup-loop pattern as
# hourly/now-playing-watch.sh (launchd/cron are TCC-blocked in ~/Documents).
#
# Start:  nohup worker/gsc-daily-watch.sh >> worker/gsc-pull.log 2>&1 &
# Stop:   kill "$(cat worker/.gsc-watch.pid)"
cd "$(dirname "$0")/.." || exit 1
echo $$ > worker/.gsc-watch.pid
while true; do
  echo "── $(date '+%Y-%m-%d %H:%M:%S') gsc-pull"
  python3 worker/gsc-pull.py --persist --days 3
  sleep 86400
done
