#!/usr/bin/env bash
# Deploy: PosterActions across grids — slug-aware provider + Watch next, movies-like, Trending, Latest.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "components/UserFilmsProvider.tsx" "components/PosterActions.tsx" \
  "components/TrendingSections.tsx" "components/LatestMagazine.tsx" \
  "app/film/[slug]/page.tsx" "app/movies-like/[slug]/page.tsx" "app/globals.css"
git -c core.pager=cat commit -m "PosterActions across grids: slug-aware provider + Watch next / movies-like / Trending / Latest"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
