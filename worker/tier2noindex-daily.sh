#!/bin/bash
# Daily Tier-2 noindex reception wave (owner chose the free daily-wave path, 2026-07-15).
# OpenAlex meters a daily budget (even with a premium key), so ONE gentle wave per day chips away at
# the addressable cohort: fetch academic-pending papers until the budget/rate runs out, load, revalidate
# the films that crossed the gate, refresh the cohort, log a measurement, then sleep 24h.
#
# Gentle by design: reception-wave uses workers=2 + RECEPTION_FAST=1 (avoids the burst-429 seen at
# high concurrency; skips the abstract fallback the index does not need).
#
# Start (survives logout, not reboot):  nohup bash worker/tier2noindex-daily.sh >/dev/null 2>&1 &
# Stop:                                  touch worker/.t2noindex-stop
# Watch:                                 tail -f factory/logs/t2noindex-daily.log
cd "$(dirname "$0")/.." || exit 1
LOG="factory/logs/t2noindex-daily.log"; mkdir -p factory/logs
rm -f worker/.t2noindex-stop
while [ ! -f worker/.t2noindex-stop ]; do
  echo "=== $(date) wave start ===" >> "$LOG"
  python3 worker/tier2noindex.py reception-wave --workers 2 >> "$LOG" 2>&1 || true
  python3 worker/tier2noindex.py revalidate            >> "$LOG" 2>&1 || true
  python3 worker/tier2noindex.py refresh               >> "$LOG" 2>&1 || true
  python3 worker/tier2noindex.py measure               >> "$LOG" 2>&1 || true
  echo "=== $(date) wave done, sleeping 24h ===" >> "$LOG"
  # sleep in 1h chunks so a stop file takes effect within the hour
  for _ in $(seq 1 24); do [ -f worker/.t2noindex-stop ] && break; sleep 3600; done
done
echo "=== $(date) stopped (.t2noindex-stop present) ===" >> "$LOG"
