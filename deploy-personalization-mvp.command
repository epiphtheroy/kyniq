#!/usr/bin/env bash
# Deploy: Personalization lean MVP — save UI everywhere + /me terminal panels.
#  · UserFilmsProvider (global) + PosterActions (on-card Seen/Watchlist/0.5 rating)
#  · SaveButton (director ♥ / lineage / trope) + LineageActions (save + add-all-to-watchlist)
#  · /me terminal: KPI strip + canon coverage + reading blind spots + WWI watchlist
# (DB migrations + RPCs already applied to Supabase.)
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "components/UserFilmsProvider.tsx" "components/PosterActions.tsx" "components/SaveButton.tsx" "components/LineageActions.tsx" \
  "app/layout.tsx" "app/me/page.tsx" "app/globals.css" \
  "app/director/[slug]/page.tsx" "app/lineage/[slug]/page.tsx" "app/trope/[slug]/page.tsx"
git -c core.pager=cat commit -m "Personalization lean MVP: save UI (PosterActions/SaveButton) + /me terminal panels (coverage/blindspots/WWI)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
