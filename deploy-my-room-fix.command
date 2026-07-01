#!/usr/bin/env bash
# Deploy: My Room fixes — absolute redirect path + noindex; exclude /my_room from
# middleware (no main-site auth/session/redirect rules apply → fully standalone).
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "public/my_room/index.html" "middleware.ts"
git -c core.pager=cat commit -m "My Room: absolute redirect + noindex; exclude /my_room from middleware (standalone)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/my_room/"
echo "Press Enter to close..."; read -r _
