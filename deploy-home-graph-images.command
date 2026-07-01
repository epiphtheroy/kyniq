#!/usr/bin/env bash
# Home: point app to home_v2_bundle_v2 (fresh fn name busts the cached old bundle →
# concept/top10/director/auteur card images now render) + swap the placeholder node
# graph for our original constellation (HomeConstellation/EntityGraph) + fill the
# blog thumbnails with film stills.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "app/page.tsx" "app/home2-app/page.tsx" "lib/home2.ts" "components/home2/BlogGraph.tsx"
git -c core.pager=cat commit -m "Home: v2 bundle (card images) + original constellation graph + blog still thumbnails"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/"
echo "Press Enter to close..."; read -r _
