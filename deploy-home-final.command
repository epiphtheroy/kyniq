#!/usr/bin/env bash
# Deploy: SWAP new v7 home → / (real data) + old home → /manifesto,
# AND fill blank cards (top10 posters, concept backdrops, director/auteur/spotlight photos).
# (home_v2_bundle RPC image fields already applied in DB.)
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "app/page.tsx" "app/manifesto/page.tsx" "lib/home2.ts" \
  "components/home2/Top10.tsx" "components/home2/ConceptTiles.tsx" \
  "components/home2/Auteurs.tsx" "components/home2/Directors.tsx"
git -c core.pager=cat commit -m "Home: swap v7 → / + /manifesto; fill card images (top10 posters, concept backdrops, director photos)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/"
echo "Press Enter to close..."; read -r _
