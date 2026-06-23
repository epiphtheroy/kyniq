#!/usr/bin/env bash
# ============================================================
# Metatake — Redesign W4a: Home v6 "The Pair" (01-home.html 시안), minus constellation
#   • method bar (.basis) — "Built on AI embeddings — not AI-generated content"
#   • HERO: the unlikely pair — 2 unlike films + the red line + the meta-take they share
#     (each via its figure), 9s auto-rotate / hover-hold / dots / Another / 10-pair gallery
#   • concept chain Film→Figure→Take→Meta-take + ten-register strip
#   • scale: 6 count-up gauges (real counts) + the embedding method
#   • four doors (Meta takes / Tropes / Directors / Concepts) with rotating real samples
#     + "Just added" ticker; manifesto
#   Real data via RPC home_bundle() (migration 0064, live). Constellation canvas = W4b (next).
#   Files: app/globals.css, components/HomeClient.tsx, app/page.tsx
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

git add app/globals.css components/HomeClient.tsx app/page.tsx
git commit -m "Redesign W4a: Home v6 The Pair — pair hero + gallery + chain + gauges + doors (home_bundle)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open https://www.metatake.net/"
echo "   Check vs 시안: method bar, the unlikely-pair hero (red line, 9s rotate, gallery), chain, count-up gauges, doors + ticker."
echo "Press Enter to close..."; read -r _
