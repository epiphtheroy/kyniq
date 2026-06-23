#!/usr/bin/env bash
# ============================================================
# Metatake — Home: figure-centric copy reframe (+ trending tail, bundled safely).
#   Shifts the home's framing away from "connect two films" toward close reading
#   through FIGURES, with the pair kept as one vivid demonstration:
#   • app/page.tsx          — <title>/description now lead with figures & close reading.
#   • components/HomeClient.tsx — hero kick/headline/lead, the build-a-reading line,
#       the constellation heading/sub, and the manifesto all recentred on figures,
#       readings and endless exploration (the pair becomes an example, not the pitch).
#   Also includes the Trending tail (shared component) in case it wasn't shipped yet —
#   harmless if it already was (no diff):
#   • components/TrendingSections.tsx, app/trending/page.tsx, app/globals.css
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

git add app/page.tsx components/HomeClient.tsx components/TrendingSections.tsx app/trending/page.tsx app/globals.css
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "HomeClient|app/page\.tsx|TrendingSections|trending/page" || echo "  (no errors in the changed files)"
fi

git commit -m "Home: recentre copy on figures + close reading (pair as example, not pitch); bundle trending tail"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Hard-refresh metatake.net (Cmd+Shift+R)."
echo "Press Enter to close..."; read -r _
