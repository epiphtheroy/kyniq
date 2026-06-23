#!/usr/bin/env bash
# ============================================================
# Metatake — Blog edition redesigned to match the email (newsletter look).
#   The on-site /blog edition now mirrors the Resend email design:
#     • paper (#F2F1EC) background, white centered card (~660px) with hairline border
#     • each item: full-width film still ON TOP → "N." numbered serif headline →
#       event → red film link → red ★ rhyme → news → red-left-rule reading → deposit box
#     • plain cutting-room-floor (dashed list, red "Cut"), black-rule method line
#   Files: components/EditionBody.tsx, app/globals.css (blg- block)
#   (Today's new edition 2026-06-19 is already published to the blog as data; this
#    deploy is the visual change — it applies to every edition, old and new.)
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

git add components/EditionBody.tsx app/globals.css
git commit -m "Blog: redesign edition to the email/newsletter look (paper card, still-on-top items, deposit box)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Check /blog and /blog/2026-06-19 — the edition"
echo "   should now read like the email: paper card, film still on top of each item."
echo "Press Enter to close..."; read -r _
