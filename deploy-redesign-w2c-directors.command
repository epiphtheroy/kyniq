#!/usr/bin/env bash
# ============================================================
# Metatake — Redesign W2c: Directors index, matched to 03-directors.html 시안
#   Reuses the generic CardDeck + Catalogue (from W2b).
#   Director card (components/indexes/DirectorsIndex.tsx):
#     • portrait (w185) + name + place·born + 3 stats (Films / Meta takes / Tropes)
#     • representative-film banner (w500 backdrop) — "traced through {rep}"
#     • Signature readings (red, ×n) → /take · Signature tropes (teal, ×n) → /trope,
#       each "via figure"; Filmography chips → /film; "Open the director →"
#   Catalogue: A–Z / Nationality / Films, cells "Name — n films · country".
#   Data: RPCs directors_featured(p_n) + directors_catalogue() (migrations 0059/0060, live).
#   Files: app/globals.css, components/CardDeck.tsx, components/Catalogue.tsx,
#          components/indexes/DirectorsIndex.tsx, app/director/page.tsx
#   This completes W2 (Films · Tropes · Directors).
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

git add app/globals.css components/CardDeck.tsx components/Catalogue.tsx components/indexes/DirectorsIndex.tsx app/director/page.tsx
git commit -m "Redesign W2c: Directors index — portrait deck + signature readings/tropes + filmography (completes W2)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open https://www.metatake.net/director"
echo "   Check vs 시안: portrait + 3 stats, rep-film banner, Signature readings/tropes (×n), A–Z/Nationality/Films."
echo "Press Enter to close..."; read -r _
