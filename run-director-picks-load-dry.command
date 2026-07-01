#!/usr/bin/env bash
# STEP 4/5 — DRY load preview: validate picks against DB filmography (no writes).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-picks-load.py --out worker/director-picks-all
echo "------"; echo "Looks right? run-director-picks-load.command to write."
echo "Press Enter to close..."; read -r _
