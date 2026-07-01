#!/usr/bin/env bash
# Replace the hero site-search on Archetype pages with a prominent in-page FILTER:
#  - remove the hero SearchBox from hub/section/detail
#  - bigger, clearer .lf filter input inside .cat-wrap (section browse + node members)
#  - add a filter over the node member list (>8 items)
# Also ships the film Strong Misreadings! element-level links change.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="app/catalog/page.tsx"
F2="app/catalog/[seg]/page.tsx"
F3="app/catalog/[seg]/[slug]/page.tsx"
F4="app/globals.css"
F5="app/film/[slug]/page.tsx"

git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4" "$F5"
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4" "$F5"
echo "------"
git -c core.pager=cat commit -m "Archetype: drop hero search, prominent in-page filter (section + node members); film Strong Misreadings! element links"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
