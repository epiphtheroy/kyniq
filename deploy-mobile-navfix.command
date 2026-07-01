#!/usr/bin/env bash
# Mobile fix: top nav wraps on small screens instead of forcing horizontal overflow
# (which was zooming the whole page out so the body showed at ~1/3 width). globals.css only.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

git -c core.pager=cat add -- app/globals.css
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- app/globals.css
echo "------"
git -c core.pager=cat commit -m "Mobile overflow fixes: wrap top nav + home gallery min-width:0 + .hm overflow-x clip"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
