#!/usr/bin/env bash
# Phase 2 — APPLY: create stub films (invisible) + attach their lineage memberships. Uses cached TMDB.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/lineage-resolve.py --apply
echo "------"; echo "Done. Lineage universe complete. Next: I build the /lineage hub pages."
echo "Press Enter to close..."; read -r _
