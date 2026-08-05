#!/bin/zsh
# Headless daily runner for the newborn-film-site scanner (launchd, 09:30).
#
# Writes FILES only — no DB, no deploy, nothing published. The output is
# state/review-queue.md, which is a TRIAGE list: HANDOFF-발견피드.md §14 is the
# record of why nothing may be published from it without a human opening each
# site (the classifier waved through a payment-intercepting phishing clone and a
# piracy player dressed as a members-only cinema).
#
# Kill switch: `touch discovery/HOLD` — same convention as hourly/. Remove to resume.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
PY=/usr/bin/python3; command -v "$PY" >/dev/null 2>&1 || PY=python3

if [ -f HOLD ]; then
  echo "── $(date) — HOLD present, skipping ──" >> state/cron.log
  exit 0
fi

mkdir -p state
echo "── $(date) — discovery scan ──" >> state/cron.log
# No --limit: the dictionary filter already cuts ~70k registrations to ~150, and
# the LLM only sees what survives a live fetch. Bounding it further would silently
# drop a day's tail rather than scan it.
"$PY" -u scan.py >> state/cron.log 2>&1
echo "── $(date) — done ──" >> state/cron.log
