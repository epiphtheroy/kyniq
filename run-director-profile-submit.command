#!/usr/bin/env bash
# STEP 2/5 — submit the Opus batch (~50% off).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-profile-batch.py submit --out worker/director-profile-all
echo "------"; echo "Next (after a while): run-director-profile-fetch.command"
echo "Press Enter to close..."; read -r _
