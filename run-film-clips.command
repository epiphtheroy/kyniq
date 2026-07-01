#!/bin/zsh
# PERSIST: collect clips into media for visible films missing them. Resumable (re-run to continue).
# Capped at 70 films per run — the YouTube Data API daily quota (10,000 units) allows
# ~79 films/day at ~126 units/film. Resumable: re-run each day to continue. Edit --limit
# if you raised your quota. No deploy needed — writes live data (ISR ~5 min).
cd "$(dirname "$0")/worker"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=film-clips.log; : > "$LOG"
$PY -u film-clips.py --persist --limit 70 2>&1 | tee -a "$LOG"
echo ""
echo "✅ Done (capped at 200/run). Re-run tomorrow to continue. Live within ISR (~5 min)."
echo "Press Enter to close..."; read -r _
