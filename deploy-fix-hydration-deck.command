#!/usr/bin/env bash
# Root-cause fix for React #418 on index pages (/film, /director, /tropes, meta-takes):
# the rotating card deck randomized its first batch inside the useState initializer,
# so server and client picked DIFFERENT cards → hydration mismatch → whole page's
# React died (which killed the new nav's interactivity). Now the first render is
# deterministic (first N) on both sides; the client reshuffles to random on mount.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "components/CardDeck.tsx" "components/IndexPattern.tsx"
git -c core.pager=cat commit -m "Fix #418 hydration: deterministic deck first-render, client-side shuffle on mount (CardDeck + IndexPattern)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min). Index pages should hydrate cleanly now."
echo "Press Enter to close..."; read -r _
