#!/bin/zsh
# Headless daily runner for the clip worker (invoked by launchd at 11:00).
# Resumable + self-limiting on YouTube quota; writes live data (no deploy).
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
PY=/usr/bin/python3; command -v "$PY" >/dev/null 2>&1 || PY=python3
echo "── $(date) — film-clips daily run ──" >> film-clips-cron.log
# 60, not 70: measured cost is ~151 YouTube units per film once the tightened
# filter widens the candidate pool, so 70 would ask for ~10,570 against the
# 10,000/day quota and the tail of the run would fail. 60 lands near 9,060.
"$PY" -u film-clips.py --persist --limit 60 >> film-clips-cron.log 2>&1
echo "── $(date) — done ──" >> film-clips-cron.log
