#!/usr/bin/env bash
# The Map: shrink the ↗ shortcut to a tiny inline glyph right after the year (was a big
# corner badge that covered the node and stole clicks). Clicking a node body now recenters
# the map again; only the small ↗ opens the entity page.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "components/EntityGraph.tsx"
git -c core.pager=cat commit -m "Map: tiny inline ↗ after year (was oversized corner badge stealing node clicks); node click recenters again"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/map"
echo "Press Enter to close..."; read -r _
