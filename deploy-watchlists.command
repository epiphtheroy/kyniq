#!/usr/bin/env bash
# Phase 1: personal Seen/Watchlist (+rating) on film pages + /me lists. (user_movies migration applied)
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="components/MovieListActions.tsx"
F2="app/film/[slug]/page.tsx"
F3="app/me/page.tsx"
F4="app/globals.css"
git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4"
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4"
echo "------"
git -c core.pager=cat commit -m "Phase 1 watchlists: Seen/Watchlist + rating on film pages + /me lists (user_movies)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
