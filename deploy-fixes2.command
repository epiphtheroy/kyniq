#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: immediate-publish + meta-take page UX + home/figure links + docs.
# Double-click: commit everything and push to origin/main (Vercel auto-deploy).
# DB (migration 0017, figure-slug backfill) already applied live via connector.
# NOTE: genre backfill is a SEPARATE step — run worker/run-tmdb-fetch-all.command.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Immediate-publish takes + meta-take page UX + figure/home links + docs

- contribution form inserts status=published (immediate, M1 resolved) + Community badge
- migration 0017: takes insert policy allows status=published for human authors
- meta-take page: 'Examples' -> 'Representative takes'; All takes of \"<title>\" heading
  with TV-Tropes-style collapsible bordered folders (genre/register toggle)
- info box: 'Takes N' count links/jumps to the #all-takes section
- home 'New figure pages': film title now links to the film page
- worker: tmdb-fetch now backfills genres+overview; run-tmdb-fetch-all.command (all films)
- docs: MASTER §8 data-integrity rules (slug/genre/links/publish), figure-page-design
  M1/M6 resolved, RUNBOOK §2.5 post-build backfill"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "➡  Then double-click worker/run-tmdb-fetch-all.command to backfill genres for all films."
echo "Press Enter to close..."; read -r _
