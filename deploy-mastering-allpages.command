#!/usr/bin/env bash
# ============================================================
# Metatake — Design-system mastering, step 2: ALL remaining pages → mobile-first
#   globals.css — every redesign block converted desktop-first → MOBILE-FIRST,
#   on the same system as the home (token scale + sm600/md900 breakpoints):
#     • idx-  Indexes (meta-takes / films / tropes / directors)
#     • lt-   Latest          • tg-  Trending          • blg-  Blog
#     • df- fg- dr- tp- mk- ak-   the six detail pages
#   For each: base = phone (grids collapse, headings fluid), the wide multi-column
#   layout restored at @media(min-width:900px) so DESKTOP (>=900) is unchanged.
#   31 mobile-first media queries in the converted region; 0 max-width queries there.
#   (Built by 10 parallel workers, then assembled + structurally verified:
#    braces balanced 1884/1884, nesting depth OK, all section markers in order.)
#   DESIGN-SYSTEM.md migration checklist updated.
#   Files: app/globals.css, DESIGN-SYSTEM.md
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

git add app/globals.css DESIGN-SYSTEM.md
git commit -m "Design-system v4: all redesign pages mobile-first (idx/lt/tg/blg + 6 detail)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). NOTE: this is a CSS-only change; the local"
echo "   typecheck doesn't compile CSS, so if Vercel's build flags anything, tell me and"
echo "   I'll fix it (a full rollback copy is saved as outputs/globals.bak.css)."
echo "   Then check Films/Tropes/Directors, Latest, Trending, Blog and a few detail pages"
echo "   on your phone — nothing should overflow; desktop should look the same as before."
echo "Press Enter to close..."; read -r _
