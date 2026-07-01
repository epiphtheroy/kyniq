#!/usr/bin/env bash
# STEP 1/5 — build batch requests for directors with >=3 films (Portrait + Who's Next, Opus).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-profile-gen.py --emit-requests --all --min-films 3 --out worker/director-profile-all
echo "------"; echo "Next: run-director-profile-submit.command"
echo "Press Enter to close..."; read -r _
