#!/usr/bin/env bash
# App-store downloads, daily — keeps mt_app_downloads fresh for /admin/app.
#   iOS:     worker/asc-sales-pull.mjs   (App Store Connect sales report, needs
#            the ASC .p8 in ~/.appstoreconnect/private_keys — owner machine only)
#   Android: worker/play-installs-pull.mjs (Play's Cloud Storage export, needs
#            PLAY_REPORTS_BUCKET in .env.local — skipped until it is set)
# Same nohup-loop pattern as worker/gsc-daily-watch.sh; started by
# restart-watchers.command. Apple cuts yesterday's report by ~09:00 KST and Play
# refreshes its month file once a day, so a 3-day window re-covers stragglers.
#
# Start:  nohup worker/app-stores-daily-watch.sh >> worker/app-stores-pull.log 2>&1 &
# Stop:   kill "$(cat worker/.app-stores-watch.pid)"
cd "$(dirname "$0")/.." || exit 1
echo $$ > worker/.app-stores-watch.pid
while true; do
  echo "── $(date '+%Y-%m-%d %H:%M:%S') app-stores-pull"
  node worker/asc-sales-pull.mjs --days 3 || echo "asc-sales-pull failed (exit $?)"
  if grep -q '^PLAY_REPORTS_BUCKET=' .env.local 2>/dev/null; then
    node worker/play-installs-pull.mjs --months 2 || echo "play-installs-pull failed (exit $?)"
  else
    echo "play-installs-pull skipped — PLAY_REPORTS_BUCKET not set (see worker/play-installs-pull.mjs)"
  fi
  sleep 86400
done
