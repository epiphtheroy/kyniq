#!/usr/bin/env bash
# Trope formation — Stage 4: GLOBAL HARMONIZE (content-aware). Finds near-identical tropes by
# centroid embedding, then an LLM merges true duplicates / differentiates collisions using each
# trope's name + note + sample readings, and links the rest as "similar tropes". Resumable
# (trope-harmonize-cache.jsonl). Reads trope-plan.json → writes trope-plan-harmonized.json.
set -uo pipefail
cd "$(dirname "$0")"
PY="$HOME/.metatake-venv/bin/python3"; [ -x "$PY" ] || PY=python3
echo "▶ Trope harmonize (Opus, content-aware).  python: $PY"
"$PY" -c 'import numpy' 2>/dev/null || { echo "❌ numpy missing in $PY"; echo "Press Enter"; read -r _; exit 1; }
"$PY" -u trope-form.py harmonize 2>&1 | tee trope-harmonize.log
echo; echo "Review final trope count + similar-edges + sample names, then tell Claude (→ persist)."
echo "Press Enter to close..."; read -r _
