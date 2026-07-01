#!/usr/bin/env bash
# Force fresh compile of the 4 image cards (concepts/top10/auteurs/directors) by renaming
# the modules — the prior build reused stale compiled versions so the new card images
# (concept backdrops, top10 posters, director photos) never rendered.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -A -- "components/home2"
git -c core.pager=cat commit -m "Home: rename 4 image-card modules to force fresh compile (concept/top10/director/auteur images)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/"
echo "Press Enter to close..."; read -r _
