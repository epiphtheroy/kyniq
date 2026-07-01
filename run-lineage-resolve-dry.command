#!/usr/bin/env bash
# Phase 2 — full TMDB resolve (DRY). ~5.5k films → a few thousand TMDB calls (~10-15 min). Resumable.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/lineage-resolve.py
echo "------"; echo "Review worker/lineage-resolve-dry.md. Good? → run-lineage-resolve.command (writes stubs)"
echo "Press Enter to close..."; read -r _
