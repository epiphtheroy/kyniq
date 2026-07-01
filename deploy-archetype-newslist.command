#!/usr/bin/env bash
# Drop the Concepts nav item (absorbed into Archetype › Theory); render archetype-detail members
# AND /concept tropes as a 2-column news-style list (thumbnail + title). concept_readings RPC
# (now returns a sample backdrop) is already applied in Supabase.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="components/MetatakeNav.tsx"
F2="app/catalog/[seg]/[slug]/page.tsx"
F3="app/concept/[slug]/page.tsx"
F4="app/globals.css"

git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4"
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4"
echo "------"
git -c core.pager=cat commit -m "Drop Concepts nav; archetype-detail + /concept render 2-column news-style list with thumbnails"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
