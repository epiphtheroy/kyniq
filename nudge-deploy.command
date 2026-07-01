#!/usr/bin/env bash
# Vercel didn't pick up the last push. Push a tiny empty commit to re-trigger the build.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

echo "▶ current HEAD:"; git -c core.pager=cat log --oneline -1
git -c core.pager=cat commit --allow-empty -m "chore: re-trigger Vercel build (Phase 2 watchlists)"
git -c core.pager=cat push origin main
echo "✅ empty commit pushed. Vercel should start building now (~2 min)."
echo "Press Enter to close..."; read -r _
