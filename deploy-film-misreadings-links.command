#!/usr/bin/env bash
# Film page Strong Misreadings: title → "Strong Misreadings!"; stop wrapping the whole row in one
# link (which underlined the entire body on hover) — link only the framework label, the via-figure,
# and the take title to their pages; body (thesis + leap) stays plain text.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="app/film/[slug]/page.tsx"
git -c core.pager=cat add -- "$F1"
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- "$F1"
echo "------"
git -c core.pager=cat commit -m "Film Strong Misreadings: 'Strong Misreadings!'; element-level links (framework/figure/title), body plain"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
