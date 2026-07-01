#!/usr/bin/env bash
# Nav IA pilot (home only): regroup the mega menu by intent —
# Watch / Wander / Ideas / Lenses / You. "Ideas" = Concepts·Theorists·Traditions.
# Tropes·Archetypes·Strong Misreadings demoted into "Lenses". Removed redundant map icon.
# Detail pages unchanged until we confirm the look here.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "components/home2/Nav.tsx" "app/home2.css"
git -c core.pager=cat commit -m "Nav IA pilot (home): intent groups Watch/Wander/Ideas/Lenses/You; Ideas umbrella; demote tropes"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → open https://metatake.net/ and click Menu"
echo "Press Enter to close..."; read -r _
