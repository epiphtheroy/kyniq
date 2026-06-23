#!/usr/bin/env bash
# ============================================================
# Metatake — Design-system mastering, step 1: token layer + HOME mobile-first
#   globals.css:
#     • NEW token layer in :root — canonical breakpoints (sm600/md900/lg1180),
#       spacing scale (--sp-*), fluid type ramp (--fs-*), --wrap-x gutter. Additive.
#     • HOME (.hm-*) converted desktop-first → MOBILE-FIRST:
#         - base = phone; full 3-col pair / 5-col gallery / 4-col grids at >=900
#         - the "pair" metaphor now survives on phones: the red connecting line
#           runs VERTICALLY (A | line | knot | reading | line | B) instead of
#           being hidden; horizontal bar returns at >=900
#         - fluid headline type (clamp) — no more per-breakpoint font overrides
#         - 11 ad-hoc breakpoints in the home block collapsed to sm600/md900
#   DESIGN-SYSTEM.md — the spec/contract the rest of the refactor follows.
#   Only the home block + :root changed; other pages are untouched this step.
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
git commit -m "Design-system v4: token layer (breakpoints/spacing/fluid type) + home mobile-first"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min)."
echo "   Check the HOME page on your phone — the two-film pair should now read"
echo "   top-to-bottom with a vertical red thread, and nothing should overflow."
echo "Press Enter to close..."; read -r _
