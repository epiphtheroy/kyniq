#!/usr/bin/env bash
# The Map (/map): full-screen force graph over the whole critical web
# (films·figures·tropes·ideas·directors·theorists). Opens on a hub cloud; click any
# node to recenter 3 rings deep; top breadcrumb trail; "Open ↗" to the page.
# map_ego + map_overview RPCs already applied. Nav "The map" repointed /lineage→/map.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "app/api/map/route.ts" "app/map/page.tsx" \
  "components/MapExplorer.tsx" "components/EntityGraph.tsx" \
  "components/home2/Nav.tsx" "app/globals.css"
git -c core.pager=cat commit -m "The Map (/map): full-screen critical-web explorer — click-to-recenter (3 rings), breadcrumb trail, Open; map_ego/map_overview RPCs; nav The map → /map"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/map  (nav: Wander → The map)"
echo "Press Enter to close..."; read -r _
