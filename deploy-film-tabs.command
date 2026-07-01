#!/usr/bin/env bash
# Film detail page: sticky section tab-bar (Invitation · Strong Misreadings! · Figures · Tropes ·
# Archetype · Films like · Information) between the stat strip and the Invitation, plus a NEW
# Archetype section (catalog classification of the film's figures). film_catalog RPC already applied.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="components/FilmTabBar.tsx"
F2="app/film/[slug]/page.tsx"
F3="app/globals.css"

git -c core.pager=cat add -- "$F1" "$F2" "$F3"
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3"
echo "------"
git -c core.pager=cat commit -m "Film page: sticky section tab-bar + new Archetype section (film_catalog)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
