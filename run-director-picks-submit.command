#!/usr/bin/env bash
# STEP 2/5 — submit 'Where to Start' requests to the Anthropic Batch API (~50% off).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-picks-batch.py submit --out worker/director-picks-all
echo "------"; echo "Wait a bit, then: run-director-picks-fetch.command (re-run until ended)"
echo "Press Enter to close..."; read -r _
