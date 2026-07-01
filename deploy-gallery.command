#!/usr/bin/env bash
# Deploy: film Gallery — separate /film/[slug]/gallery page (TMDB images, live+ISR, noindex+canonical)
# + Gallery tab (link-type) in the film tab bar. REQUIRES Vercel env TMDB_READ_TOKEN (same as worker/.env.local).
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "components/FilmTabBar.tsx" "components/GalleryViewer.tsx" \
  "app/film/[slug]/gallery/page.tsx" "app/film/[slug]/page.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Film Gallery: separate /gallery page (TMDB images, noindex+canonical) + link-type Gallery tab"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min). Make sure TMDB_READ_TOKEN is set in Vercel env."
echo "Press Enter to close..."; read -r _
