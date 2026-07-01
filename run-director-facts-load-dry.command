#!/usr/bin/env bash
# DRY: preview director_facts load (no DB writes).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-facts-load.py --out worker/director-facts-all
echo "------"; echo "If good → run-director-facts-load.command (writes)"
echo "Press Enter to close..."; read -r _
