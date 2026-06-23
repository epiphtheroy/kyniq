#!/bin/zsh
# Metatake — blog ingest (PERSIST). Publishes the NEWEST substack draft to the blog
# (upserts a published posts row). Data only — no deploy needed; the edition appears at
# /blog within the ISR window (~2 min). Idempotent (re-running re-upserts the same slug).
#   - Aborts if any internal link doesn't resolve (404 would kill the premise).
#   - Override that gate only if you're sure:  ./run-blog-ingest.command --force
#   - Specific date:  ./run-blog-ingest.command --date 2026-06-19
# If the draft's front-matter status is "hold", it will refuse to publish.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=blog-ingest.log; : > "$LOG"
echo "▶ Blog ingest — PERSIST ($(date))" | tee -a "$LOG"
$PY -u blog-ingest.py --persist "$@" 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ If it printed 'Published /blog/<date>', the edition is live within ~2 min (data only)." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
