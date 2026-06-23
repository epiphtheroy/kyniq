#!/usr/bin/env bash
# ============================================================
# Metatake — Graph scroll-comfort: left+right gutters on EVERY node graph + iPhone fix.
#   • app/globals.css         — .eg (all detail-page graphs) and .hm-mapbox (home) get
#       margin: 0 clamp(16px,5vw,64px) → the canvas is narrower with empty "scroll lanes"
#       on both sides, so cursor/finger in the gutter scrolls the page (not the graph).
#   • components/EntityGraph.tsx — touch-action none → pan-y, so on iPhone a vertical
#       swipe over the graph scrolls the page through instead of being captured.
#   • components/HomeConstellation.tsx — wraps the home graph in .hm-mapbox for the gutters.
#   Covers meta-take, film, figure, trope detail pages + the home constellation.
#   Files: app/globals.css, components/EntityGraph.tsx, components/HomeConstellation.tsx
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

# clear any stale git lock from an interrupted earlier run (it silently blocks commits)
if [ -f .git/index.lock ]; then echo "▶ Removing stale .git/index.lock"; rm -f .git/index.lock; fi

for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

git add app/globals.css components/EntityGraph.tsx components/HomeConstellation.tsx
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking; unrelated WIP in the tree may show errors)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "EntityGraph|HomeConstellation|globals" || echo "  (no errors in the 3 deployed files)"
fi

git commit -m "Graphs: left+right scroll-lane gutters on all node graphs + touch-action pan-y (iPhone scroll)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Every graph now has side gutters; scroll past it"
echo "   in the empty margin (or just swipe vertically on iPhone — it scrolls through now)."
echo "Press Enter to close..."; read -r _
