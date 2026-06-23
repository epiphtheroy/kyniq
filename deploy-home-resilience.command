#!/usr/bin/env bash
# ============================================================
# Metatake — Home page resilience (stop caching an EMPTY bundle).
#   app/page.tsx: home_bundle() is now fetched with 3 retries; if it still comes
#   back empty/timed-out (e.g. while the embedding pipeline hammers the DB), the
#   page THROWS instead of rendering an empty bundle — so Next/ISR keeps serving
#   the last good page (featured pair + live stats) rather than caching zeros.
#   Pairs with the DB-side fix already applied: home_bundle statement_timeout → 15s.
#   Files: app/page.tsx
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

git add app/page.tsx
git commit -m "Home: retry home_bundle + throw on persistent empty (don't cache empty bundle under load)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min) — the fresh build also purges the stale empty cache."
echo "Press Enter to close..."; read -r _
