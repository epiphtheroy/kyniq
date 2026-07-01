#!/usr/bin/env bash
# Deploy: save-layer schema adaptation — MovieListActions (independent Seen/Watchlist + 0.5 stars),
# /me reads new booleans + numeric rating. REQUIRED after the user_movies migration.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "components/MovieListActions.tsx" "app/me/page.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Save layer: user_movies seen/watchlist booleans + 0.5 rating (MovieListActions, /me)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
