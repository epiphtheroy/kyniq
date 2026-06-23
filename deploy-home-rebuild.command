#!/usr/bin/env bash
# ============================================================
# Metatake — Rebuild the home (the bounded-Latest commit's build had FAILED).
#   The previous deploy (bounded Latest + About band) failed to BUILD on Vercel
#   because /blog's static generation hit the database while it was overloaded by
#   the trope-build job (>60s, 3 attempts → build error). So the live site stayed on
#   the older infinite-scroll home.
#   Fix shipped here:
#   • app/blog/page.tsx — the blog index fetch is now capped (AbortSignal 4.5s) and
#     wrapped in try/catch, so a slow DB can never hang/fail the build again.
#   Committing this triggers a fresh build that ALSO includes the already-pushed
#   bounded-Latest home + About band. The DB is idle now, so it will build cleanly.
#   File: app/blog/page.tsx
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

git add app/blog/page.tsx
echo "▶ Staged:"; git diff --cached --name-only

git commit -m "Blog index: resilient build-time fetch (abort + fallback) so a slow DB can't fail the build; rebuild bounded home"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~2 min). This build includes the bounded Latest home + About band."
echo "   Then hard-refresh metatake.net (Cmd+Shift+R): the home now ends (12 latest → About → footer)."
echo "Press Enter to close..."; read -r _
