#!/usr/bin/env bash
# Surprise me (/random): immersive one-card draw across 5 kinds (Film/Reading/Trope/Idea/
# Director), each with its richest detail (director "The Life" fact, concept native term, etc.),
# muted autoplay clip, instant client re-roll (Space), trail, deep-link Open. surprise() RPC applied.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "app/api/surprise/route.ts" "app/api/surprise/set/route.ts" "app/random/page.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Surprise me: fix build (rename gridLoading), drop Trope, full reading text, 30-card wall + 'another 30', clip 7s"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/random"
echo "Press Enter to close..."; read -r _
