#!/usr/bin/env bash
# ============================================================
# Metatake — Redesign W3a: Latest (magazine), matched to 06-latest-trending.html 시안
#   • edition header + title + Latest|Trending toggle (links) + entity-colour legend
#   • magazine masonry (varied box sizes) with infinite scroll, mixed entity boxes:
#       Film (hero + via-figure + movies-like), Meta take & Trope (laconic + film cases),
#       Director (portrait + signatures), Concept (n films), Reading (register-coloured
#       band + snippet → reads-as). Every box = one link; figures/readings as text (no
#       nested anchors). Entity colours per spec §8.
#   • client cycles a real pool (no extra fetches); images fade in + re-measure masonry.
#   Data: RPC latest_pool() (migration 0061, live).
#   Files: app/globals.css, components/LatestMagazine.tsx, app/latest/page.tsx
#   (Trending half = W3b, next.)
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

git add app/globals.css components/LatestMagazine.tsx app/latest/page.tsx
git commit -m "Redesign W3a: Latest magazine — entity-colour masonry + infinite scroll (latest_pool)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open https://www.metatake.net/latest"
echo "   Check vs 시안: edition header, legend, varied masonry boxes (film/meta/trope/director/concept/reading), infinite scroll."
echo "Press Enter to close..."; read -r _
