#!/usr/bin/env bash
# Revert the v7 header design on /idea/[slug] back to the previous simple page
# (MetatakeNav + readings list). Keeps the RLS-safe RPC data load so it doesn't 404.
# Also removes the unused masthead CSS and restores Nav's required data prop.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "app/idea/[slug]/page.tsx" "components/home2/Nav.tsx" "app/home2.css"
git -c core.pager=cat commit -m "Revert /idea/[slug] to simple page (MetatakeNav); keep RLS-safe RPC load"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/idea/repetition-compulsion"
echo "Press Enter to close..."; read -r _
