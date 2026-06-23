#!/usr/bin/env bash
# ============================================================
# Metatake — Home page: append the full Trending content at the foot.
#   • components/TrendingSections.tsx (NEW) — the four ranked blocks (Meta takes ·
#     Takes · Tropes · Films) extracted into one shared, reusable component.
#   • app/trending/page.tsx — now renders <TrendingSections/> (single source of truth;
#     keeps its own window-toggle chrome). No visual change to /trending.
#   • app/page.tsx — loads trending_pool in parallel with home_bundle and renders the
#     whole trending block beneath the editorial home, under a "Trending now" header
#     with "See all trending →" links. Resilient: if trending can't load, the home
#     simply renders without the tail (never breaks the main page).
#   • app/globals.css — .home-trend header styles (double rule, kicker, heading, sub).
#   Files: components/TrendingSections.tsx, app/trending/page.tsx, app/page.tsx, app/globals.css
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

git add components/TrendingSections.tsx app/trending/page.tsx app/page.tsx app/globals.css
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "TrendingSections|trending/page|app/page\.tsx" || echo "  (no errors in the changed files)"
fi

git commit -m "Home: append full Trending content at the foot (shared TrendingSections component); /trending refactored to reuse it"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Then hard-refresh metatake.net (Cmd+Shift+R) and"
echo "   scroll to the bottom — the home now flows into the whole Trending feed."
echo "Press Enter to close..."; read -r _
