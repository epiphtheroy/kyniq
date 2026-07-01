#!/usr/bin/env bash
# Deploy: rich concept detail page at /idea/[slug] (6 sections: masthead, sticky subnav,
# Definition, Tropes, Films, Theorist, Connection map, Related) on canonical concepts.
# DB already applied (canonical cols, concept_detail RPC, canonical home/hub concepts).
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "app/concept-detail.css" "app/idea/[slug]/page.tsx" \
  "components/home2/ConceptSubnav.tsx" "components/home2/ConceptMap.tsx"
git -c core.pager=cat commit -m "Concept detail: rich 6-section /idea/[slug] on canonical concepts (concept_detail RPC + EntityGraph map)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/idea/repetition-compulsion"
echo "Press Enter to close..."; read -r _
