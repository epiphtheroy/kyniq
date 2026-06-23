#!/usr/bin/env bash
# ============================================================
# Metatake — Hide this expansion's films until trope/meta-take work is done
#   DB (already live via migrations 0067-0072):
#     • films.hold flag; visibility trigger now = (>=3 figures) AND (NOT hold)
#     • held every film added 2026-06-17 onward (1,392); originals (<=06-13) stay live
#     • all surfacing RPCs (catalogue/featured/latest/trending/home/search) respect visible
#       → held films vanish from browse, decks, Latest/Trending, on-site search
#   This deploy ships the matching front-end gates:
#     • sitemap.ts        — only visible films / their directors / their questions
#     • film detail        — noindex when not visible (held)
#     • figure detail      — noindex when its film is not visible (held)
#   Fully reversible: when ready, UPDATE films SET hold=false WHERE created_at>='2026-06-17'
#   (then figures>=3 films re-appear automatically). Verified: 559 originals visible, 0 held leak.
#   Files: app/sitemap.ts, app/film/[slug]/page.tsx, app/film/[slug]/figure/[figureSlug]/page.tsx
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

git add app/sitemap.ts "app/film/[slug]/page.tsx" "app/film/[slug]/figure/[figureSlug]/page.tsx"
git commit -m "Hide expansion films (hold gate): sitemap + film/figure noindex when not visible"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Expansion films are now out of the catalogue,"
echo "   home/latest/trending, on-site search, sitemap, and are noindex on their detail pages."
echo "Press Enter to close..."; read -r _
