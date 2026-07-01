#!/usr/bin/env bash
# Lineage Phase 1 — APPLY: write lineage_lists/editions/auteur lines + film_lineage (existing films).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/lineage-ingest.py --apply
echo "------"; echo "Done. Lineage data loaded. Next: I deploy the film 'Lineage' tab."
echo "Press Enter to close..."; read -r _
