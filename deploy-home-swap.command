#!/usr/bin/env bash
# Deploy: SWAP — new v7 home becomes / (indexable, real data via home_v2_bundle),
# and the old home content goes live at /manifesto. Other pages untouched.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "app/page.tsx" "app/manifesto/page.tsx"
git -c core.pager=cat commit -m "Swap home: new v7 map home at / (real data) + old home preserved at /manifesto"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/  (and /manifesto)"
echo "Press Enter to close..."; read -r _
