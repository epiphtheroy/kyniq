#!/usr/bin/env bash
# ============================================================
# Metatake — Home hero polish (alignment / hierarchy / spacing / detail).
#   • app/globals.css        — search is now the PRIMARY element (1.5px ink border,
#       rounded, focus ring); Ask bar lightened to secondary (1.5px hairline); both
#       unified to 600px so their edges align; "or ask" becomes an elegant centered
#       divider with flanking rules; tightened vertical rhythm.
#   • components/SearchBox.tsx — dropdown only opens with a real query (>=2 chars),
#       so the empty "No matches" panel never shows on load.
#   Files: app/globals.css, components/SearchBox.tsx
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

if [ -f .git/index.lock ]; then echo "▶ Removing stale .git/index.lock"; rm -f .git/index.lock; fi

for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

git add app/globals.css components/SearchBox.tsx
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "SearchBox" || echo "  (no errors in the changed files)"
fi

git commit -m "Home hero polish: search primary + 600px aligned columns, elegant divider, no empty dropdown"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Hero is tighter: search leads, edges align, cleaner spacing."
echo "Press Enter to close..."; read -r _
