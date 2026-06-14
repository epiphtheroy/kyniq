#!/usr/bin/env bash
# ============================================================
# Metatake — deploy the app (pages, nav, token renderer, migration files).
# Double-click to commit everything and push to origin/main (Vercel deploy).
# NOTE: this deploys the CODE. The DATA build (migration + import) is run
# separately on your machine — see RUNBOOK-metatake.md.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "feat: Metatake pivot — figure→take→meta take spine. migration 0013 (figures/meta_takes/takes/rankings/edges/affinities/theory_families/theorists), import+consolidate+author+rank+recommend workers, token link renderer, wiki-style pages (/take, /film, /director, /meta-takes, /genre, home, random), light blue design, frame layer removed from nav/spine."
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main'."
echo "Pages render empty until the DATA build runs — see RUNBOOK-metatake.md."
echo "Press Enter to close..."; read -r _
