#!/bin/zsh
# Metatake — Theory Phase 3: embed theory_canon (~2,587 rows) with text-embedding-3-small.
# Fills theory_canon.embedding in the SAME space as takes, so readings can be matched to
# the tradition they lean on. Idempotent (skips rows already embedded). Tiny one-off OpenAI cost.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=theory-canon-embed.log; : > "$LOG"
echo "▶ theory-canon-embed PERSIST ($(date))" | tee -a "$LOG"
$PY -u theory-canon-embed.py 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Done. Canon embedded. Tell Claude to run the tradition match (SQL)." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
