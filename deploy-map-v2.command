#!/usr/bin/env bash
# The Map v2: poster nodes (films) + face circles (directors) across all modes,
# year/birth-year faint inline (no parens), per-node ↗ shortcut to the entity page,
# bigger center, film map 3 levels deep, filter grid (Year/IMDb/Rotten Tomatoes for
# films, Year for directors). RPCs + API enrichment already applied.
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
git -c core.pager=cat commit -m "Map v2: poster/face nodes + inline year, per-node open arrow, bigger center, film 3-levels, filter grid (year/imdb/rt)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/map"
echo "Press Enter to close..."; read -r _
