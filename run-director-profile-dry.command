#!/usr/bin/env bash
# DRY pilot: Portrait + Who's Next for 6 well-filmed directors (Opus). No DB writes.
# Review worker/director-profile-dry.md before the full batch.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 worker/director-profile-gen.py --out worker/director-profile-dry
echo "------"
echo "Review: worker/director-profile-dry.md"
echo "Press Enter to close..."; read -r _
