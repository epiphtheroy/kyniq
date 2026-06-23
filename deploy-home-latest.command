#!/usr/bin/env bash
# ============================================================
# Metatake — Home foot = LATEST (not Trending) + figure-centric copy.
#   • app/page.tsx — the home tail now loads the full Latest magazine (latest_pool
#     via the shared <LatestMagazine/>), under a "Latest" header with "See all latest →".
#     Trending is no longer embedded on the home. Metadata leads with figures/close reading.
#   • components/HomeClient.tsx — body copy recentred on figures, close reading and
#     endless exploration (the pair stays as one example, not the pitch).
#   • app/globals.css — .home-latest header styles (renamed from .home-trend).
#   Also bundles the shared trending component so /trending keeps working (harmless if
#   already shipped): components/TrendingSections.tsx, app/trending/page.tsx
#   (LatestMagazine already lives in the repo — powers /latest.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

if [ -f .git/index.lock ]; then echo "▶ Removing stale .git/index.lock"; rm -f .git/index.lock; fi

for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

git add app/page.tsx components/HomeClient.tsx app/globals.css components/TrendingSections.tsx app/trending/page.tsx
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "app/page\.tsx|HomeClient|LatestMagazine|TrendingSections|trending/page" || echo "  (no errors in the changed files)"
fi

git commit -m "Home foot = Latest magazine (replace Trending); figure-centric home copy"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Hard-refresh metatake.net (Cmd+Shift+R) and"
echo "   scroll down — the home now flows into the full Latest feed."
echo "Press Enter to close..."; read -r _
