#!/usr/bin/env bash
# Deploy: film page ratings badges (OMDb) + "Where to watch" country channels (TMDB/JustWatch).
# Null-safe — renders only where data exists, so safe to deploy before/after the data run.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "app/film/[slug]/page.tsx" "components/WatchProviders.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Film page: ratings badges (IMDb/RT/Metascore) + Where to watch (country channels, JustWatch attribution)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
