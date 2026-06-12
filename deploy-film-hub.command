#!/usr/bin/env bash
# FilmCurio — film hub 2-zone redesign deploy.
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "feat: film hub 2-zone redesign — preview zone (spoiler-zero pitch, fact-sheet record, aesthetic-experience level + comparables), spoiler boundary banner, reception section, 'where this film sits' frame chips; migration 0012 + film-features generator + plan doc"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main'."
echo "Press Enter to close..."; read -r _
