#!/usr/bin/env bash
# Metatake — surface "Movies like" better + color thumbs.
#   • Film page: prominent "🎬 Movies like {film} →" pill button + "see all →" link
#     beside the "Films most connected to…" section.
#   • /movies-like thumbnails: full color + zoom/brighten on hover (was grayscale).
#   Files: app/film/[slug]/page.tsx, app/globals.css
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add "app/film/[slug]/page.tsx" app/globals.css
git commit -m "Surface Movies-like (pill CTA + 'see all' link); color movies-like thumbs with hover zoom"
git push origin main
echo "✅ Pushed. Vercel rebuilds (~1-2 min)."
echo "Press Enter to close..."; read -r _
