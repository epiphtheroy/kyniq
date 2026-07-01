#!/usr/bin/env bash
# DRY preview of incremental-additive trope assignment (read-only, NO writes).
# Shows the nearest-trope similarity histogram + how many unassigned takes would be
# assigned at the default threshold. Tune --thresh, then run a scoped --persist.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH

# Default: preview over ALL currently-unassigned takes (diagnostic).
# For a new-film ingest run instead, edit to:  --films slug-a,slug-b
python3 worker/trope-incremental.py --all-null --thresh 0.72

echo "------"
echo "DRY only. To publish for specific new films:"
echo "  python3 worker/trope-incremental.py --films <slug,slug> --thresh 0.72 --persist"
echo "Press Enter to close..."; read -r _
