#!/usr/bin/env bash
# Top nav: keep the bar full-width (bg + border) but center its contents in a max-width container
# so on ultra-wide monitors the menu aligns with the page content instead of sprawling edge-to-edge.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="components/MetatakeNav.tsx"
F2="app/globals.css"

git -c core.pager=cat add -- "$F1" "$F2"
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2"
echo "------"
git -c core.pager=cat commit -m "Nav: center contents in a max-width container (full-width bar) so it aligns with content on wide screens"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
