#!/usr/bin/env bash
# ============================================================
# Metatake — hide thin/just-added films (SEO + UI) until they have content.
#   A film is "visible" only with >=3 approved figures (films.visible column,
#   kept up to date by a DB trigger — already live). This deploy makes the app:
#     • noindex thin film pages + drop them from sitemap.xml  (app/film/[slug], app/sitemap.ts)
#     • hide them from the /film catalogue, /director, and /genre listings
#       (app/film/page.tsx, app/director/[slug], app/genre/[slug], app/genre)
#   home_pool / search / random / seq_nav are already filtered in the DB (live migrations).
#   Everything auto-reverses: once film-extract gives a film >=3 figures, it reappears.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add "app/film/[slug]/page.tsx" app/sitemap.ts app/film/page.tsx "app/director/[slug]/page.tsx" "app/genre/[slug]/page.tsx" app/genre/page.tsx
git commit -m "Hide thin films (<3 figures): noindex + sitemap + listing/discovery filters (visible flag)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Just-added films are now hidden from"
echo "   listings + search engines; they reappear automatically once extracted."
echo "Press Enter to close..."; read -r _
