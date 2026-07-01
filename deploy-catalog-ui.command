#!/usr/bin/env bash
# Catalog UI v1 — hub + section + node pages, nav item, figure "Classified as" line, CSS.
# The catalog read-RPCs are already applied in Supabase, so the UI can ship immediately.
# Brackets in route paths → GIT_LITERAL_PATHSPECS so they're committed literally.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="lib/catalog.ts"
F2="app/catalog/page.tsx"
F3="app/catalog/[seg]/page.tsx"
F4="app/catalog/[seg]/[slug]/page.tsx"
F5="components/MetatakeNav.tsx"
F6="app/film/[slug]/figure/[figureSlug]/page.tsx"
F7="app/globals.css"

git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4" "$F5" "$F6" "$F7"
echo "▶ committing ONLY:"
git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4" "$F5" "$F6" "$F7"
echo "------"
git -c core.pager=cat commit -m "Catalog UI v1: hub + section + node pages, nav, figure Classified-as line"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min). Visit /catalog when live."
echo "Press Enter to close..."; read -r _
