#!/usr/bin/env bash
# STEP 3/5 — fetch results (re-run until it says all batches ended).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-profile-batch.py fetch --out worker/director-profile-all
echo "------"; echo "When all ended → run-director-profile-load-dry.command"
echo "Press Enter to close..."; read -r _
