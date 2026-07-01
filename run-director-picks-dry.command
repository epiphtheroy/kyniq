#!/usr/bin/env bash
# STEP 0 — DRY pilot (6 directors) for 'Where to Start'. Review worker/director-picks-dry.md before the full run.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-picks-gen.py --out worker/director-picks-dry
echo "------"; echo "Review worker/director-picks-dry.md — then run-director-picks-emit.command"
echo "Press Enter to close..."; read -r _
