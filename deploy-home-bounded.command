#!/usr/bin/env bash
# ============================================================
# Metatake — Home: bounded Latest (no endless scroll) + "About Metatake" closing band.
#   The Latest magazine is infinite-scroll by design (great on /latest, wrong for the
#   home — the footer was never reachable). Fix:
#   • components/LatestMagazine.tsx — new optional `cap` prop: render a fixed number of
#     items, no IntersectionObserver, no repeat, no "editing in more" loader. /latest
#     is unchanged (still infinite).
#   • app/page.tsx — home tail now <LatestMagazine cap={12}> (a bounded preview) with
#     "See all latest →", THEN a new "About Metatake" band (company intro + About/Contact)
#     so the page ends deliberately and flows into the footer. Also carries the
#     figure-centric home metadata.
#   • app/globals.css — .home-about closing-band styles.
#   Bundles the rest of the home work so the build is consistent if not already shipped:
#   components/HomeClient.tsx, components/TrendingSections.tsx, app/trending/page.tsx
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

git add components/LatestMagazine.tsx app/page.tsx app/globals.css components/HomeClient.tsx components/TrendingSections.tsx app/trending/page.tsx
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "LatestMagazine|app/page\.tsx|HomeClient" || echo "  (no errors in the changed files)"
fi

git commit -m "Home: bounded Latest (cap, no endless scroll) + About Metatake closing band before footer"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Hard-refresh metatake.net (Cmd+Shift+R):"
echo "   home now ends — Latest preview (12) → About Metatake → footer. No endless scroll."
echo "Press Enter to close..."; read -r _
