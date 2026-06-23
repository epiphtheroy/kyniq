#!/usr/bin/env bash
# Deploy: film page (Strong Misreadings first, full reading + leap) + trope-page safe redirect
# (no 404 on retired slugs) + Latest/Trending new-model components.
set -uo pipefail
cd "$(dirname "$0")"
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git add "app/film/[slug]/page.tsx" "app/trope/[slug]/page.tsx" app/globals.css components/LatestMagazine.tsx components/TrendingSections.tsx
echo "▶ staged:"; git diff --cached --name-only
git commit -m "Film: Strong Misreadings first, full reading + leap. Trope: redirect retired slugs to /tropes. Latest/Trending: new-model reading cards."
git push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
