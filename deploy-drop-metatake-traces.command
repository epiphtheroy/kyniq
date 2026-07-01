#!/usr/bin/env bash
# Remove "meta-take" traces from the director, Trending and Home surfaces.
# Director: drop dead reading-meta-take "Signature meta takes" section + "Meta takes"
#   stat + per-film "meta takes" count → Strong Misreadings (Readings) + Signature tropes.
# Home (HomeClient/AskHero/page): gauges drop Meta-takes (Takes→Readings); concept chain
#   step 04 Meta-take→Trope, step 03 ten registers→critical frameworks; "Ten registers"
#   chips→14 framework chips; doors Meta-takes→Films; hero hint drops "Meta takes".
# Trending: page description drops "meta takes".
set -uo pipefail
cd "$(dirname "$0")"
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git add "app/director/[slug]/page.tsx" "app/trending/page.tsx" "app/page.tsx" "components/HomeClient.tsx" "components/AskHero.tsx"
echo "▶ staged:"; git diff --cached --name-only
git commit -m "Drop meta-take traces from director / trending / home (→ Strong Misreadings + frameworks)"
git push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
