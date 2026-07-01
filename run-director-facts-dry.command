#!/usr/bin/env bash
# DRY pilot: "The Life" 30 facts for 3 directors (web-grounded: Wikipedia + bio → Opus). No DB writes.
# Review worker/director-facts-dry.md (facts must be source-true: real dates, places, numbers).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-facts-gen.py --out worker/director-facts-dry
echo "------"; echo "Review: worker/director-facts-dry.md"
echo "Press Enter to close..."; read -r _
