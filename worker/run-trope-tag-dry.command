#!/usr/bin/env bash
# ============================================================
# Tropes stage 1 — TYPE TAGS (DRY: 3 films, prints tags, no writes).
# Review the tags' quality (film-agnostic? screenwriter-useful?) before the full run.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ trope-tag DRY (3 films) — $(date)"
python3 trope-tag.py --limit 3
echo
echo "✅ Dry complete — nothing written. If the tags look right, run run-trope-tag.command."
echo "Press Enter to close..."; read -r _
