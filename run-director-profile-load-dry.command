#!/usr/bin/env bash
# STEP 4/5 — DRY: resolve Who's-Next names + preview (NO DB writes).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-profile-load.py --out worker/director-profile-all
echo "------"; echo "If resolution looks good → run-director-profile-load.command (writes)"
echo "Press Enter to close..."; read -r _
