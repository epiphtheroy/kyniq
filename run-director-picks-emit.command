#!/usr/bin/env bash
# STEP 1/5 — build batch requests for 'Where to Start' (directors with >=3 films, Opus).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-picks-gen.py --emit-requests --all --min-films 3 --out worker/director-picks-all
echo "------"; echo "Next: run-director-picks-submit.command"
echo "Press Enter to close..."; read -r _
