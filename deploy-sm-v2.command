#!/usr/bin/env bash
# Strong Misreadings v2: direct framework names + clickable film rows + search/featured/image upgrades.
# DB (already applied): row image fields; readings_semantic / readings_suggest / readings_featured; trgm index.
# App: frameworks.ts renamed labels+slugs (Subtext/Ontology/Semiotics/Production/Reception/Psychoanalysis/
#   Ethics/Politics/Counterpart/Parallel…); film page Strong-Misreading rows fully clickable; ReadingFeed
#   rewritten (smb-* classes — fixes left-rule collision; typeahead; semantic search; rotating featured cards;
#   right-side thumbnails; decade facet); /api/readings semantic routing + /suggest + /featured; CSS.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="lib/frameworks.ts"
F2="app/film/[slug]/page.tsx"
F3="app/strong-misreadings/[fw]/page.tsx"
F4="components/ReadingFeed.tsx"
F5="app/api/readings/route.ts"
F6="app/api/readings/suggest/route.ts"
F7="app/api/readings/featured/route.ts"
F8="app/globals.css"

git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4" "$F5" "$F6" "$F7" "$F8"
echo "▶ committing ONLY:"
git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4" "$F5" "$F6" "$F7" "$F8"
echo "------"
git -c core.pager=cat commit -m "Strong Misreadings v2: direct framework names, clickable film rows, semantic search + typeahead, featured cards, row images"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
