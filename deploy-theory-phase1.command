#!/usr/bin/env bash
# Deploy: Theory Phase 1 — /theorist hub + /theorist/[slug] (readings through a theorist),
# theorist chips on figure pages now link, "Theory" nav item. (DB backfill already applied.)
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "components/MetatakeNav.tsx" "app/theorist/page.tsx" "app/theorist/[slug]/page.tsx" \
  "app/film/[slug]/figure/[figureSlug]/page.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Theory Phase 1: /theorist hub + theorist pages + linked theorist chips + Theory nav"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
