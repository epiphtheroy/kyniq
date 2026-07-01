#!/usr/bin/env bash
# STEP 3/5 — fetch finished 'Where to Start' batches. Re-run until it reports 0 still processing.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-picks-batch.py fetch --out worker/director-picks-all
echo "------"; echo "When done: run-director-picks-load-dry.command"
echo "Press Enter to close..."; read -r _
