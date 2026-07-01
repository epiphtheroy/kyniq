#!/usr/bin/env bash
# Phase 2: lazy TMDB import — search & add ANY film to Seen/Watchlist (/me),
#          Tier-2 catalog record (visible=false) + minimal noindex film page.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="app/api/tmdb-search/route.ts"
F2="app/api/track/route.ts"
F3="components/MovieSearchAdd.tsx"
F4="app/me/page.tsx"
F5="app/film/[slug]/page.tsx"
F6="app/globals.css"
git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4" "$F5" "$F6"
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4" "$F5" "$F6"
echo "------"
git -c core.pager=cat commit -m "Phase 2 watchlists: lazy TMDB import (add any film) + Tier-2 catalog page"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
