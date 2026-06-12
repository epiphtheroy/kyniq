#!/usr/bin/env bash
# FilmCurio — performance fix deploy.
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "perf: enable ISR on all public pages (was force-dynamic everywhere — zero edge caching), client-side header auth (cookies() in layout forced whole site dynamic + 2 blocking auth calls per view), kill film-page N+1s (per-question contribution counts, sequential most-read lookups), parallelize independent Supabase queries on home/film/question/frame pages"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main'."
echo "Press Enter to close..."; read -r _
