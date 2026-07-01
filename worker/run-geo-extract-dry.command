#!/usr/bin/env bash
# Geographic Atlas — stage 1 DRY: extract real place names from films (no DB writes).
# Reviews to worker/geo-extract-dry.json. Needs ANTHROPIC_API_KEY + Supabase env in ../.env.local
# Scope one film:  GEO_FILMS=some-slug-2020 ./run-geo-extract-dry.command  (passes --films)
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ geo-extract (DRY)"
python3 geo-extract.py ${GEO_FILMS:+--films "$GEO_FILMS"}
echo; echo "Review geo-extract-dry.json, then run run-geo-extract-apply.command"
echo "Press Enter to close..."; read -r _
