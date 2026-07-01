#!/usr/bin/env bash
# Deploy: Gallery as a scrolling framed feed (load-more on scroll) + artwork captions;
# show Gallery link on non-curated (catalog) film pages too.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "components/GalleryViewer.tsx" "app/film/[slug]/gallery/page.tsx" "app/film/[slug]/page.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Gallery: scrolling framed feed + captions; Gallery link on catalog (non-curated) films"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
