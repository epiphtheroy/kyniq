#!/usr/bin/env bash
# ============================================================
# Metatake — Redesign W4b: Home constellation (completes W4 "The Pair")
#   Adds the missing "The constellation is alive" section from 01-home.html:
#   an interactive canvas graph built from the home pairs —
#     • Films / Figures toggle, drag to pan, scroll to zoom
#     • hover a star to light up its cosine-near neighbours; gentle drift
#   Inserted between the scale gauges and the four doors, per the mockup order.
#   Files: app/globals.css, components/HomeConstellation.tsx, components/HomeClient.tsx
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typechecking (tsconfig.check.json) with $(node -v 2>/dev/null)…"
  if npx tsc -p tsconfig.check.json --noEmit; then echo "✓ Typecheck passed."
  else echo "✗ Typecheck FAILED — not pushing."; echo "Press Enter to close..."; read -r _; exit 1; fi
else
  echo "⚠ Node/npx not on PATH — skipping local typecheck (Vercel build will gate)."
fi

git add app/globals.css components/HomeConstellation.tsx components/HomeClient.tsx
git commit -m "Redesign W4b: Home constellation canvas (Films/Figures graph) — completes W4"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open https://www.metatake.net/"
echo "   Check: the dark 'constellation' section between gauges and doors — Films/Figures toggle, hover-to-light, drag/zoom."
echo "Press Enter to close..."; read -r _
