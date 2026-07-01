#!/usr/bin/env bash
# STEP 5/5 — APPLY: write director_picks. 'Where to Start' tab appears on those directors within ISR (~5 min).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-picks-load.py --out worker/director-picks-all --apply
echo "------"; echo "Done. 'Where to Start' now live on those director pages."
echo "Press Enter to close..."; read -r _
