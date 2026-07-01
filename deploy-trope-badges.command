#!/usr/bin/env bash
# Trope maturity → shiny pill badges (Noble/Fresh/Emerging/Established/Cliché), and show
# the badge next to the film count on the /tropes index list + featured deck.
# (Trope detail + related-trope cards pick up the new .tp-mat badge styling automatically.)
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="app/globals.css"
F2="components/IndexPattern.tsx"

git -c core.pager=cat add -- "$F1" "$F2"
echo "▶ committing ONLY:"
git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2"
echo "------"
git -c core.pager=cat commit -m "Trope maturity as shiny pill badges + show on /tropes index next to film count"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
