#!/usr/bin/env bash
# The Map → 3 selectable modes (tabs): Films (default) · Directors · Grouped.
#  • Films: Watch next (→), Recommended by (→), Film like (—). 20 at a time, click for more.
#  • Directors: Who's next (→), Recommended by (→), Similar directors by embedding (5).
#  • Grouped: the heterogeneous critical web (films·figures·tropes·ideas·directors·theorists).
# Directed arrowheads added to the force graph. RPCs + director_embedding already applied.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "components/EntityGraph.tsx" "components/MapExplorer.tsx" \
  "app/api/map/route.ts" "app/globals.css"
git -c core.pager=cat commit -m "The Map: Films/Directors/Grouped mode tabs — film next+recby+like, director who's-next+recby+embedding-similar(5), directed arrowheads"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/map  (tabs: Films · Directors · Grouped)"
echo "Press Enter to close..."; read -r _
