#!/usr/bin/env bash
# Perf/SEO batch:
# - home_bundle_cached: home reads a lazy-refresh cache (counts materialized in the cached
#   payload; self-refreshes after TTL — already applied in DB).
# - sitemap: add /strong-misreadings hub + 14 framework pages (replace retired /meta-takes).
# - SEO meta: canonical + openGraph on framework pages.
# - tz fix: Trending/Latest edition date rendered in Asia/Seoul (was server UTC).
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="app/page.tsx"
F2="app/sitemap.ts"
F3="app/trending/page.tsx"
F4="app/latest/page.tsx"
F5="app/strong-misreadings/[fw]/page.tsx"

git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4" "$F5"
echo "▶ committing ONLY:"
git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4" "$F5"
echo "------"
git -c core.pager=cat commit -m "Perf/SEO: home_bundle lazy cache; strong-misreadings sitemap + canonical/og; Trending/Latest date tz (Asia/Seoul)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
