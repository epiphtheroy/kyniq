#!/usr/bin/env bash
# Rename the Catalog category to "Archetype" (nav label, hub kicker, breadcrumbs) and make the
# hub cards read "Object Archetype / Character Archetype / Place Archetype / Theme / Concept".
# Route stays /catalog. Brackets in paths → GIT_LITERAL_PATHSPECS.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="components/MetatakeNav.tsx"
F2="app/catalog/page.tsx"
F3="app/catalog/[seg]/page.tsx"
F4="app/catalog/[seg]/[slug]/page.tsx"

git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4"
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4"
echo "------"
git -c core.pager=cat commit -m "Rename Catalog category to Archetype (nav + hub kicker/cards + breadcrumbs); cards show '<X> Archetype'"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
