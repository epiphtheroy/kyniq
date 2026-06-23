#!/usr/bin/env bash
# Deploy: Latest/Trending/home-foot reading cards on the new model (framework + take_title).
# Pairs with the already-applied latest_pool/trending_pool RPC update.
set -uo pipefail
cd "$(dirname "$0")"
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git add components/LatestMagazine.tsx components/TrendingSections.tsx
echo "▶ staged:"; git diff --cached --name-only
git commit -m "Latest/Trending: reading cards on new model (framework + take_title); drop dead meta-take section"
git push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
