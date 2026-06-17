#!/usr/bin/env bash
# Run the Ask Metatake eval against the live site (after deploy + OPENAI_API_KEY set).
# Override target: ASK_URL=http://localhost:3000/api/ask ./run-ask-eval.command
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ ask-eval — ${ASK_URL:-https://metatake.net/api/ask}"
python3 ask-eval.py
echo
echo "Press Enter to close..."; read -r _
