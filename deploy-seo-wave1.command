#!/usr/bin/env bash
# ============================================================
# Metatake — SEO Wave 1 (no LLM needed; pure code, ships now).
#   • NEW /movies-like/[slug] pages — "Movies like {film}", from film_affinities,
#     each with the shared readings as the "why". (high-demand evergreen query)
#   • Film pages: unique 1-line intro ("Metatake reads {film} through N figures…")
#     + a "Movies like {film} →" link + per-page og:title/description.
#   • Figure pages: title reframed to "{element} in {film}, explained" (long-tail
#     "{element} meaning" queries) + FAQPage JSON-LD.
#   • Reading (/take) & Trope (/trope) hubs: BreadcrumbList + Article JSON-LD +
#     per-page og:title (structured data the hubs lacked).
#   • sitemap.xml now lists /movies-like for content-filled films.
#   Files: app/movies-like/[slug]/page.tsx, app/film/[slug]/page.tsx,
#     app/film/[slug]/figure/[figureSlug]/page.tsx, app/take/[slug]/page.tsx,
#     app/trope/[slug]/page.tsx, app/sitemap.ts, app/globals.css
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add "app/movies-like/[slug]/page.tsx" "app/film/[slug]/page.tsx" \
        "app/film/[slug]/figure/[figureSlug]/page.tsx" "app/take/[slug]/page.tsx" \
        "app/trope/[slug]/page.tsx" app/sitemap.ts app/globals.css
git commit -m "SEO Wave 1: /movies-like pages, figure 'explained' titles + FAQ, film intro, hub JSON-LD + og, sitemap"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Check a film page for the 'Movies like →' link,"
echo "   and open /movies-like/<a film slug> directly."
echo "Press Enter to close..."; read -r _
