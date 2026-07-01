#!/usr/bin/env bash
# Nav fixes: (1) dropdowns now open via pure CSS :hover — works even on pages whose
# body has a hydration hiccup, and the .ng:hover area covers label+gap+dropdown so it
# no longer closes while moving the mouse in. (2) Logo is a single-line "Metatake".
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "app/home2.css" "components/home2/Nav.tsx"
git -c core.pager=cat commit -m "Nav: CSS :hover dropdowns (hydration-proof + no close-on-move) + single-line logo"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min). Check hover on /film and the logo."
echo "Press Enter to close..."; read -r _
