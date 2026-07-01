#!/usr/bin/env bash
# Deploy: per-take save (Strong Misreading bookmark) — UserSavesProvider + SaveChip on film & figure pages.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "components/UserSavesProvider.tsx" "components/SaveChip.tsx" "components/ReadingFeed.tsx" "app/layout.tsx" \
  "app/film/[slug]/page.tsx" "app/film/[slug]/figure/[figureSlug]/page.tsx" \
  "app/me/page.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Per-take save: UserSavesProvider + SaveChip (film/figure) + /me Saved readback"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
