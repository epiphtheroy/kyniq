#!/usr/bin/env bash
# Geographic Atlas — stage 1 APPLY: write film_locations rows (coords NULL).
# Then run run-geo-code.command to fill coordinates.
# Scope one film (new-film ingest):  GEO_FILMS=some-slug-2020 ./run-geo-extract-apply.command
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ geo-extract (APPLY)"
python3 geo-extract.py --apply ${GEO_FILMS:+--films "$GEO_FILMS"}
echo; echo "Now run run-geo-code.command to geocode."
echo "Press Enter to close..."; read -r _
