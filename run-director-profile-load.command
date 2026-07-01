#!/usr/bin/env bash
# STEP 5/5 — APPLY: write director_portrait + director_next. Pages auto-show within ISR (~5 min).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-profile-load.py --out worker/director-profile-all --apply
echo "------"; echo "Done. Portrait + Who's Next tabs now live on those directors."
echo "Press Enter to close..."; read -r _
