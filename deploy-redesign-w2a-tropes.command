#!/usr/bin/env bash
# ============================================================
# Metatake — Redesign W2a: Tropes index (teal), matched to 05-tropes.html 시안
#   Reuses the W1 deck+catalogue engine via IndexPattern variant="trope":
#     • teal accents (cnt, def rule, kick, dots, A–Z hover) — readmore + hovers stay red
#     • card: laconic + 3-line definition + kindline (N figures across M films) +
#       "Figures — the film, and the figure that instantiates the trope" + 5 cases
#     • catalogue A–Z / Most films / Newest (no "Just seeded"), tot "a working catalogue"
#     • consumes RPCs tropes_featured(p_n) + tropes_catalogue() (migration 0057, live)
#   Files: app/globals.css, components/IndexPattern.tsx, app/tropes/page.tsx
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

# locate Node (double-clicked .command has a minimal PATH)
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

# typecheck gate (aborts push on type errors)
find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typechecking (tsconfig.check.json) with $(node -v 2>/dev/null)…"
  if npx tsc -p tsconfig.check.json --noEmit; then echo "✓ Typecheck passed."
  else echo "✗ Typecheck FAILED — not pushing."; echo "Press Enter to close..."; read -r _; exit 1; fi
else
  echo "⚠ Node/npx not on PATH — skipping local typecheck (Vercel build will gate)."
fi

git add app/globals.css components/IndexPattern.tsx app/tropes/page.tsx
git commit -m "Redesign W2a: Tropes index (teal) — deck + catalogue matched to 05-tropes mockup"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open https://www.metatake.net/tropes"
echo "   Check vs 시안: teal accents, 3-line def + kindline, 5 cases, A–Z/Most films/Newest."
echo "Press Enter to close..."; read -r _
