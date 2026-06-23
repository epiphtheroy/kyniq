#!/usr/bin/env bash
# ============================================================
# Metatake — Trending readability fixes (CSS only)
#   1+3. Strip "via figure" caption (meta takes & tropes) — larger (12px) + darker (ink-soft)
#   2.   Takes: register badge now sits on its own line above the figure title (was stuck to it)
#   File: app/globals.css
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
  echo "▶ Typechecking…"
  if npx tsc -p tsconfig.check.json --noEmit; then echo "✓ Typecheck passed."
  else echo "✗ Typecheck FAILED — not pushing."; echo "Press Enter to close..."; read -r _; exit 1; fi
else
  echo "⚠ Node/npx not on PATH — skipping local typecheck (Vercel build will gate)."
fi

git add app/globals.css
git commit -m "Trending: clearer via-figure captions + separate register badge from figure title"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Recheck https://www.metatake.net/trending"
echo "Press Enter to close..."; read -r _
