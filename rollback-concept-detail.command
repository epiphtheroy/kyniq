#!/usr/bin/env bash
# Rollback: undo the concept-detail redesign commit (b8db0b2). Restores the previous
# /idea/[slug] page and removes concept-detail.css / ConceptSubnav / ConceptMap.
# The new home is untouched. (DB home/hub RPCs already reverted separately.)
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat revert --no-edit b8db0b28d9488ad1a7d3c3d80d4ffeab713b8ec2
git -c core.pager=cat push origin main
echo "✅ pushed revert. Vercel builds (~2 min) → /idea/[slug] back to previous version."
echo "Press Enter to close..."; read -r _
