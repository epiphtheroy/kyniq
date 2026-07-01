#!/usr/bin/env bash
# Director page → tabbed layout (Portrait / Filmography / Where to Start / The Life / Who's Next).
# Phase 1: Portrait uses TMDB bio + computed signature tropes; Filmography live.
# The 3 AI corners appear per-director once their batch data lands (director_portrait/picks/facts/next).
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="app/director/[slug]/page.tsx"
F2="app/globals.css"
git -c core.pager=cat add -- "$F1" "$F2"
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2"
echo "------"
git -c core.pager=cat commit -m "Director page: tabbed layout (Portrait/Filmography/Where to Start/The Life/Who's Next) + corner schema"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
