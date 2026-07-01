#!/usr/bin/env bash
# FULL: The Life for all directors >=3 films (Opus 4.8 free-write + Brave verify EN+native). Resumable.
# Heavy + slow (per-fact Brave ~1 req/s, Opus + Sonnet per director) — expect a few hours. Re-run to resume.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-facts-gen.py --all --min-films 3 --out worker/director-facts-all
echo "------"; echo "When done → run-director-facts-load-dry.command"
echo "Press Enter to close..."; read -r _
