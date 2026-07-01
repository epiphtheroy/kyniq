#!/usr/bin/env bash
# Lineage Phase 1 — DRY: resolve film_lineage to EXISTING films, report coverage (no writes).
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/lineage-ingest.py
echo "------"; echo "Review worker/lineage-ingest-dry.md — then run-lineage-ingest.command"
echo "Press Enter to close..."; read -r _
