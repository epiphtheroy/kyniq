#!/bin/zsh
# Headless daily runner for the clip worker (invoked by launchd at 11:00).
# Resumable + self-limiting on YouTube quota; writes live data (no deploy).
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
PY=/usr/bin/python3; command -v "$PY" >/dev/null 2>&1 || PY=python3
echo "── $(date) — film-clips daily run ──" >> film-clips-cron.log
"$PY" -u film-clips.py --persist --limit 70 >> film-clips-cron.log 2>&1
echo "── $(date) — done ──" >> film-clips-cron.log
