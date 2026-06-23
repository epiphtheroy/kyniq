#!/usr/bin/env bash
# ============================================================
# Metatake — Redesign W2b: Films index, matched to 04-films.html 시안
#   New generic engine shared by Films + (next) Directors:
#     • components/CardDeck.tsx   — the rotating deck engine (7s / 5min / hover-pause)
#     • components/Catalogue.tsx  — sort tabs + A–Z jump bar + filter + 3-col grid
#   Films card (components/indexes/FilmsIndex.tsx):
#     • hero backdrop band (w780) + genre badge + title/year/dir overlay
#     • 3 stats (Figures / Readings / Tropes) + "via figure" two columns
#       (Meta takes red → /take · Tropes teal → /trope)
#     • "Movies like {film}" kin chips → /movies-like; "Open the film →"
#   Catalogue: A–Z / Genre / Year (decades), cells "Title (year) · director".
#   Data: RPCs films_featured(p_n) + films_catalogue() (migration 0058, live).
#   Files: app/globals.css, components/CardDeck.tsx, components/Catalogue.tsx,
#          components/indexes/FilmsIndex.tsx, app/film/page.tsx
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

git add app/globals.css components/CardDeck.tsx components/Catalogue.tsx components/indexes/FilmsIndex.tsx app/film/page.tsx
git commit -m "Redesign W2b: Films index — hero deck + via-figure columns + movies-like + catalogue (generic CardDeck/Catalogue)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open https://www.metatake.net/film"
echo "   Check vs 시안: hero backdrop card, 3 stats, Meta takes/Tropes via-figure, Movies-like chips, A–Z/Genre/Year."
echo "Press Enter to close..."; read -r _
