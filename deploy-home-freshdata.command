#!/usr/bin/env bash
# Fix: home was pinned to a stale build-time RPC bundle (missing the new card images).
# Make / and /home2-app fetch the home_v2_bundle fresh (dynamic, cache:no-store) so
# concept backdrops, top10 posters and director photos actually render.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "app/page.tsx" "app/home2-app/page.tsx"
git -c core.pager=cat commit -m "Home: fetch bundle fresh (dynamic, no-store) so card images render — fix stale data cache"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/"
echo "Press Enter to close..."; read -r _
