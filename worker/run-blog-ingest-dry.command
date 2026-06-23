#!/bin/zsh
# Metatake — blog ingest (DRY). Parses the NEWEST substack draft (substack/drafts/*.md),
# resolves each film's year+backdrop, and VERIFIES every internal /film, /take, /trope link
# resolves on the live DB. Prints the result. No DB writes.
#   Pass a specific date if needed:  (open Terminal)  ./run-blog-ingest-dry.command --date 2026-06-19
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=blog-ingest.log; : > "$LOG"
echo "▶ Blog ingest — DRY ($(date))" | tee -a "$LOG"
$PY -u blog-ingest.py "$@" 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ DRY done. Check the items + any '✗' bad links, then run run-blog-ingest.command to publish." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
