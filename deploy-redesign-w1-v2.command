#!/usr/bin/env bash
# ============================================================
# Metatake — Redesign W1 (v2): Meta takes index, matched to final v4 시안
#   Fidelity fixes vs first pass:
#     • def/intro copy = v4 ("What's a meta take?" figures→take→meta take · "N doors")
#     • card cases: TEXT left / THUMBNAIL right, year in (parens), 5 cases
#     • label "Defining cases — the film, and the figure that carries the reading"
#     • tags: theory · register · theorist (each with axis label), theorist now shown
#     • deck stacking fans right+down (v4 pos math); film-strip thumb + fade-in (w342)
#     • "Just seeded" <details> section for 0-film readings (split from catalogue)
#     • readmore "Open the meta-take →", catalogue title/sub/filter/count copy = v4
#   Data: migrations 0055/0056 — meta_takes_featured now returns theorist + clean
#         family (theory_families → tradition fallback) + 5 defining cases. (already live)
#   Files: app/globals.css, components/IndexPattern.tsx, app/meta-takes/page.tsx
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

# --- locate Node toolchain (double-clicked .command has a minimal PATH) ---
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

# --- pre-flight typecheck gate (authoritative on the Mac; aborts push on type errors) ---
find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typechecking (tsconfig.check.json) with $(node -v 2>/dev/null)…"
  if npx tsc -p tsconfig.check.json --noEmit; then
    echo "✓ Typecheck passed."
  else
    echo "✗ Typecheck FAILED — not pushing. Fix the errors above and re-run."
    echo "Press Enter to close..."; read -r _
    exit 1
  fi
else
  echo "⚠ Node/npx not found on PATH — skipping local typecheck."
  echo "  Vercel's build (next build) will typecheck on its side; a type error there"
  echo "  fails the build and the current site stays live, so this is still safe."
fi

git add app/globals.css components/IndexPattern.tsx app/meta-takes/page.tsx
git commit -m "Redesign W1 (v2): Meta takes index matched to final v4 mockup (cases, tags, deck fan, seeded)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open https://www.metatake.net/meta-takes"
echo "   Check vs 시안: text-left/thumb-right cases, (year), theory·register·theorist tags,"
echo "   fanned deck, film-strip thumbs fading in, 'Just seeded' section at the bottom."
echo "Press Enter to close..."; read -r _
