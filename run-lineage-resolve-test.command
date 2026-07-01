#!/usr/bin/env bash
# Phase 2 TEST — TMDB-resolve a 300-film slice (DRY). Check quality + speed before the full run.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/lineage-resolve.py --limit 300
echo "------"; echo "Review worker/lineage-resolve-dry.md. Good? → run-lineage-resolve-dry.command (full)"
echo "Press Enter to close..."; read -r _
