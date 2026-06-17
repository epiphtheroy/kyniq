#!/usr/bin/env bash
# ============================================================
# Tropes stage 2 — cluster tags into tropes (DRY: embeds tags + reports, no writes).
# Embeds the ~12k distinct tags (one-time, ~$0.10) then prints the candidate tropes
# (clusters spanning >=5 films) so you can judge whether they're coherent before naming.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ trope-build DRY — $(date)"
python3 trope-build.py
echo
echo "✅ Dry complete — embeddings stored, no tropes created. Paste the list to Claude to review."
echo "Press Enter to close..."; read -r _
