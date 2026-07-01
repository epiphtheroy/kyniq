#!/usr/bin/env bash
# Geographic Atlas — stage 2: geocode film_locations (lat/lng NULL → coords) via
# Google Geocoding (set GOOGLE_MAPS_KEY) or free Nominatim. Cache-backed → cheap re-runs.
# DRY first (no flag) prints distinct uncoded names + sample; pass nothing to preview.
set -uo pipefail
cd "$(dirname "$0")"
MODE="${1:-}"
echo "▶ geo-code ${MODE:-(DRY)}"
python3 geo-code.py $MODE
echo; echo "DRY shows what would be geocoded. To write coords: ./run-geo-code.command --apply"
echo "Press Enter to close..."; read -r _
