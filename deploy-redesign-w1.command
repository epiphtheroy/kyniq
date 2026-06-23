#!/usr/bin/env bash
# ============================================================
# Metatake — Redesign W1: Meta takes index (deck + catalogue)
#   New reusable index pattern from index-redesign-finals/02-meta-takes.html:
#     • .def definition block + intro
#     • rotating card deck (7s rotate / 5min reshuffle / hover-pause), real via-figure
#       — consumes RPC meta_takes_featured(p_n) (migration 0054, already live)
#     • full catalogue — A–Z default (articles ignored), sticky jump-bar, 3-col,
#       sort tabs (A–Z / Most films / Newest), live filter
#       — consumes RPC meta_takes_catalogue() (migration 0054, already live)
#   Also W0: thumbnails already in COLOR (no grayscale anywhere — verified).
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
# Remove iCloud conflict-copy artifacts that break tsc's include globs.
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
git commit -m "Redesign W1: Meta takes index — rotating deck + catalogue (reusable .idx pattern)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open https://www.metatake.net/meta-takes"
echo "   Check: deck rotates & pauses on hover, A–Z jump-bar, sort tabs, filter, color thumbs."
echo "Press Enter to close..."; read -r _
