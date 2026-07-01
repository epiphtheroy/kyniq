#!/usr/bin/env bash
# Deploy: film-page Lineage rows now show the awarding body + a small emblem
# (Academy 🏆 / Cannes 🌴 / Sight & Sound 📖 …), so "Best Picture" reads as an Oscar.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "lib/lineageBodies.ts" "components/FilmLineageSection.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Lineage rows: awarding body + emblem (Oscars/Cannes/Sight & Sound …)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
