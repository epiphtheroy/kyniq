#!/usr/bin/env bash
# ============================================================
# Metatake — Blog refinements (reads like a letter, not a list)
#   1. /blog "Today's edition" now shows the FULL edition body (images + news +
#      reading + deposit), at letter width — not the compact 5-row grid.
#   2. /blog/[slug] softened: removed the heavy entry dividers + the big red-barred
#      left numbers + the boxed emap rule → flows as one continuous letter.
#   Shared body extracted to components/EditionBody.tsx (used by both pages).
#   Files: app/globals.css, components/EditionBody.tsx, app/blog/page.tsx, app/blog/[slug]/page.tsx
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

git add app/globals.css components/EditionBody.tsx "app/blog/page.tsx" "app/blog/[slug]/page.tsx"
git commit -m "Blog: Today's edition shows full body w/ images; soften post dividers + left numbers (reads like a letter)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Recheck https://www.metatake.net/blog and /blog/2026-06-18"
echo "Press Enter to close..."; read -r _
