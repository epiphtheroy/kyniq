#!/usr/bin/env bash
# ============================================================
# Metatake — Redesign W5a: Blog "Between Film and the World" + subscribe capture
#   Standalone daily-column blog (07/08/09 시안):
#     • /blog            — hero + subscribe card, today's edition (5 rhymes), recent
#       editions, closing subscribe band
#     • /blog/[slug]      — full edition: ranked entries (event → film·★, news, red-left
#       reading, "In Metatake" deposit, film thumb), mid-article + end subscribe,
#       cutting-room floor, "Retrieved, not remembered" method note
#     • /blog/subscribe   — dedicated subscribe page
#     • internal links = red (lk-in), external = ↗ (lk-out)
#   Subscribe stores to Supabase (newsletter_subscribers) via SECURITY DEFINER RPC
#   newsletter_subscribe() — private list, dedup, email-validated. (Resend send = W5b.)
#   "Blog" added to the nav. Seed: today's edition (the real sample) — migration 0065.
#   Files: app/globals.css, components/MetatakeNav.tsx, components/SubscribeForm.tsx,
#          app/blog/page.tsx, app/blog/[slug]/page.tsx, app/blog/subscribe/page.tsx
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
  echo "▶ Typechecking (tsconfig.check.json) with $(node -v 2>/dev/null)…"
  if npx tsc -p tsconfig.check.json --noEmit; then echo "✓ Typecheck passed."
  else echo "✗ Typecheck FAILED — not pushing."; echo "Press Enter to close..."; read -r _; exit 1; fi
else
  echo "⚠ Node/npx not on PATH — skipping local typecheck (Vercel build will gate)."
fi

git add app/globals.css components/MetatakeNav.tsx components/SubscribeForm.tsx "app/blog/page.tsx" "app/blog/[slug]/page.tsx" "app/blog/subscribe/page.tsx"
git commit -m "Redesign W5a: Blog Between Film and the World + subscribe capture (posts/newsletter_subscribers) + Blog nav"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open https://www.metatake.net/blog"
echo "   Check: hero + subscribe, today's edition (5 rhymes), a full edition at /blog/2026-06-18, subscribe form stores."
echo "Press Enter to close..."; read -r _
