#!/usr/bin/env bash
# APPLY: write director_facts. The Life tab appears on those directors within ISR (~5 min).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-facts-load.py --out worker/director-facts-all --apply
echo "------"; echo "Done. 'The Life' now live on those director pages."
echo "Press Enter to close..."; read -r _
