#!/usr/bin/env bash
# Deploy: new home REAL-DATA preview at metatake.net/home2-app (noindex).
# React port (components/home2) + scoped CSS + contract, fed by home_v2_bundle() RPC
# (already applied in DB). Does NOT touch the live home (/). Review gate before swap.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "lib/home2.ts" "app/home2.css" "components/home2/" "app/home2-app/"
git -c core.pager=cat commit -m "New home (v7) React port + scoped CSS + contract, real-data preview at /home2-app"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/home2-app"
echo "Press Enter to close..."; read -r _
