#!/usr/bin/env bash
# ============================================================
# Metatake — Detail pages redesign (v6), all 6 at once
#   Matched to detail-pages/01-06 mockups; each keeps its existing data loader,
#   metadata/JSON-LD/robots, MetatakeNav active, and behaviour components
#   (EntityGraphLoader map, TakeExplorer, ListFilter, SeqNav, Provenance, etc.).
#     • Film     /film/[slug]                     (df-)
#     • Figure   /film/[slug]/figure/[figureSlug] (fg-)  + FigureDetailBits count-up
#     • Director /director/[slug]                 (dr-)
#     • Trope    /trope/[slug]                    (tp-, teal)
#     • Meta take/take/[slug]                     (mk-, red) + MetatakeDetailBits
#     • Ask      /ask                             (ak-)  — keeps /api/ask
#   CSS appended to globals.css (prefixed, self-contained). One red #E3120B,
#   tropes teal #167C6B, colour images, register §7 colours.
#   The Mac typecheck below validates ALL pages before pushing — a hard gate.
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
  echo "▶ Typechecking ALL detail pages (tsconfig.check.json) with $(node -v 2>/dev/null)…"
  if npx tsc -p tsconfig.check.json --noEmit; then
    echo "✓ Typecheck passed."
  else
    echo "✗ Typecheck FAILED — NOT pushing. Copy the errors above to Claude to fix."
    echo "Press Enter to close..."; read -r _; exit 1
  fi
else
  echo "⚠ Node/npx not on PATH — skipping local typecheck (Vercel build will gate)."
fi

git add app/globals.css components/detail \
  "app/film/[slug]/page.tsx" "app/film/[slug]/figure/[figureSlug]/page.tsx" \
  "app/director/[slug]/page.tsx" "app/trope/[slug]/page.tsx" \
  "app/take/[slug]/page.tsx" "app/ask/page.tsx"
git commit -m "Redesign: all 6 detail pages to v6 (film/figure/director/trope/meta take/ask)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Check, with real slugs:"
echo "   /film/parasite-2019 · /film/parasite-2019/figure/<fig> · /director/quentin-tarantino"
echo "   /trope/the-mid-story-genre-turn · /take/the-cyborg · /ask"
echo "Press Enter to close..."; read -r _
