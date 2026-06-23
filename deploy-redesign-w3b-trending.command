#!/usr/bin/env bash
# ============================================================
# Metatake — Redesign W3b: Trending, matched to 06-latest-trending.html 시안
#   Completes W3. Shares the edition header + Latest|Trending toggle (links) + window
#   toggle (This week / All time via ?window=).
#   Four ranked areas, each shown through the films & figures that carry it:
#     • Meta takes (#E3120B) — rank + "{n} films share this reading" + 3 film cases (via figure)
#     • Takes (#A8434F) — register badge + figure + 2-line snippet + "→ meta take" + thumb
#     • Tropes (#167C6B) — rank + "{fg} figures · {n} films" + 3 cases
#     • Films (#26303B) — rank + backdrop + "dir · {n} readings" + via-figure list
#   Real ranking: views (week via view_events / all via view_count) + likes + connectedness.
#   Data: RPC trending_pool(p_window) (migrations 0062/0063, live).
#   Files: app/globals.css, app/trending/page.tsx
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

git add app/globals.css app/trending/page.tsx
git commit -m "Redesign W3b: Trending — 4 ranked areas via films & figures (trending_pool); completes W3"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open https://www.metatake.net/trending"
echo "   Check vs 시안: window toggle, 4 colour-coded ranked areas, film strips (via figure), take snippets."
echo "Press Enter to close..."; read -r _
