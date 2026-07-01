#!/usr/bin/env bash
# The Map: (1) FIX posters/faces not showing — a global img{max-width:100%} was collapsing
# the node image width to 0; force max-width:none. (2) Make the name+year label clickable
# to recenter, with a hover underline / link cursor.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "components/EntityGraph.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Map: fix poster/face thumbnails (max-width:none vs global reset); clickable name+year label recenters with hover underline"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/map"
echo "Press Enter to close..."; read -r _
