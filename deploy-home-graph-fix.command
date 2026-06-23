#!/usr/bin/env bash
# ============================================================
# Metatake — Home graph fix
#   The bespoke constellation canvas was rendering broken. Replaced it with the
#   proven EntityGraph force-renderer (the same graph used on entity pages):
#   the unlikely pairs as a graph — two films joined by the meta-take they share.
#   Drag a node, hover to focus, click to travel in.
#   Files: components/HomeConstellation.tsx, components/HomeClient.tsx
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

git add components/HomeConstellation.tsx components/HomeClient.tsx
git commit -m "Home: replace broken constellation canvas with proven EntityGraph (films joined by shared meta-takes)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Recheck the graph section on https://www.metatake.net/"
echo "Press Enter to close..."; read -r _
