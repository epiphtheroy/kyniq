#!/usr/bin/env bash
# ============================================================
# Metatake — Perf S1: ISR caching tuning (immediate, safe).
#   The heavy index/home RPCs run ~1.3–2.2s each (home_bundle 2.2s, the catalogues
#   ~1.3s, latest/trending pools ~1.6s). They only run on ISR *regeneration*; raising
#   revalidate makes regeneration far rarer → much less DB load (helps the running
#   pipeline too) and users keep hitting the cached page.
#     home        300 → 900s
#     meta-takes/films/tropes/directors  300 → 1800s
#     latest/trending                    120 → 600s
#   Front-end only (no DB change). The deeper structural win (materialize the live
#   count views + cache home_bundle) is queued for right after the pipeline finishes.
#   Files: app/page.tsx, app/meta-takes/page.tsx, app/film/page.tsx, app/tropes/page.tsx,
#          app/director/page.tsx, app/latest/page.tsx, app/trending/page.tsx
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

git add app/page.tsx app/meta-takes/page.tsx app/film/page.tsx app/tropes/page.tsx app/director/page.tsx app/latest/page.tsx app/trending/page.tsx
git commit -m "Perf: raise ISR revalidate on heavy index/home pages (fewer slow-RPC regenerations)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Heavy pages now regenerate far less often."
echo "Press Enter to close..."; read -r _
