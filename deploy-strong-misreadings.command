#!/usr/bin/env bash
# New top-level category: Strong Misreadings.
# DB (already applied): combined title+rationale FTS index; readings_by_framework / framework_facets /
#   frameworks_overview RPCs.
# App: nav item; hub /strong-misreadings (14 framework cards by family + global search);
#   /strong-misreadings/[fw] search-first faceted infinite feed (+ "all"); /api/readings; frameworks slugs; CSS.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="lib/frameworks.ts"
F2="app/api/readings/route.ts"
F3="components/MetatakeNav.tsx"
F4="components/ReadingFeed.tsx"
F5="app/strong-misreadings/page.tsx"
F6="app/strong-misreadings/[fw]/page.tsx"
F7="app/globals.css"

git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4" "$F5" "$F6" "$F7"
echo "▶ committing ONLY:"
git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4" "$F5" "$F6" "$F7"
echo "------"
git -c core.pager=cat commit -m "Strong Misreadings: top-level category + hub + per-framework search/faceted feed" -- "$F1" "$F2" "$F3" "$F4" "$F5" "$F6" "$F7"
echo "------ pushing ------"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
