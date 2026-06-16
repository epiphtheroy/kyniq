#!/usr/bin/env bash
# ============================================================
# Tropes stage 1 — TYPE TAGS, FULL RUN (PERSIST all films).
# Opus, 1 call/film (~562 calls, ~$6-8). Idempotent: skips already-tagged
# figures, so it's safe to re-run if it stops mid-way.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ trope-tag FULL — $(date)"
echo "  ⚠ WRITES TO DB. ~562 films, Opus. Re-run safely if interrupted."
python3 trope-tag.py --persist
echo
echo "✅ Tagging done. Tell Claude — next is stage 2 (cluster + name tropes)."
echo "Press Enter to close..."; read -r _
