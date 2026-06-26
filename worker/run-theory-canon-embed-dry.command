#!/bin/zsh
# Metatake — Theory Phase 3 DRY: shows how many canon rows would be embedded + a sample basis.
# No writes, no OpenAI cost. Safe to run anytime.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ theory-canon-embed DRY ($(date))"
$PY -u theory-canon-embed.py --dry
echo ""
echo "Press Enter to close..."; read -r _
