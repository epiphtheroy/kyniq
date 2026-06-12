#!/usr/bin/env bash
# FilmCurio — frames index + nav deploy.
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "feat: /frames dimension index (approved frames grouped by dimension with live counts), 'Questions' nav item, frame hub <title> fix, --all-gated approve+rank mode, spoiler-backfill robustness (token limit, lenient validation)"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main'."
echo "Press Enter to close..."; read -r _
