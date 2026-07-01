#!/usr/bin/env bash
# The Map: (1) in-map fuzzy search box (top-left of the graph) over films/directors/tropes/
# ideas/theorists/figures — pick a result to jump the map there. (2) Filter grid no longer
# auto-applies; a small "Apply" button applies the Year/IMDb/RT selection. map_search RPC applied.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "app/api/map/search/route.ts" "components/MapExplorer.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Map: in-graph fuzzy search (jump to any entity) + filter grid Apply button (map_search RPC)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/map"
echo "Press Enter to close..."; read -r _
