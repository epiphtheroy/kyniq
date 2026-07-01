#!/usr/bin/env bash
# Nav counts + Wander cleanup (home): add real counts (Theorists 898, Traditions 342,
# Strong Misreadings 26,975, Concepts canonical 1,078); drop "Recommended" from Wander
# (deduped with You → For you). DB already applied (concept hub canonical, theorist count).
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "components/home2/Nav.tsx" "lib/home2.ts"
git -c core.pager=cat commit -m "Nav: real counts (theorists/traditions/readings, canonical concepts); drop Recommended from Wander"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → open https://metatake.net/ and click Menu"
echo "Press Enter to close..."; read -r _
