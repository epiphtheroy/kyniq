#!/usr/bin/env bash
# ============================================================
# Tropes stage 1 — TYPE TAGS pilot (PERSIST 3 films, ~a few cents).
# Writes tags for 3 films so the result can be inspected in the DB.
# Safe + reversible (only 3 films; easily cleared if the prompt needs tuning).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ trope-tag PILOT (persist 3 films) — $(date)"
python3 trope-tag.py --persist --limit 3
echo
echo "✅ Done — 3 films' tags written. Tell Claude to verify."
echo "Press Enter to close..."; read -r _
