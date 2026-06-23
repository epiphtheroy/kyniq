#!/bin/zsh
# Metatake — film-extract PILOT (DRY). Generates figures+takes for 3 well-known new
# films so you can judge quality BEFORE the full run. Writes film-extract.bundle.json.
# NO database writes. Model: Claude Opus 4.8 (needs ANTHROPIC_API_KEY in worker/.env.local).
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=film-extract-pilot.log; : > "$LOG"
echo "▶ film-extract PILOT (DRY) — Vertigo / Tokyo Story / Seven Samurai ($(date))" | tee -a "$LOG"
$PY -u film-extract.py --film vertigo-1958 --film tokyo-story-1953 --film seven-samurai-1954 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ DRY done. Review worker/film-extract.bundle.json — or just tell me it's done and I'll read it." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
