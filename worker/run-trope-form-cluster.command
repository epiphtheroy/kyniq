#!/usr/bin/env bash
# Trope formation — detailed candidate clusters (DRY, no LLM) at the CHOSEN setting:
#   method=twopass · tau_core=0.64 · tau_attach=0.50  (cores + edge-absorb; ~3% Noble).
# Prints band distribution + top/mid sample clusters and writes trope-clusters.json for the gate.
# Override from Terminal:  ./run-trope-form-cluster.command 0.50 0.64
set -uo pipefail
cd "$(dirname "$0")"
PY="$HOME/.metatake-venv/bin/python3"; [ -x "$PY" ] || PY=python3
echo "▶ Trope formation — detailed clusters (no LLM).  python: $PY"
"$PY" -c 'import numpy' 2>/dev/null || { echo "❌ numpy missing in $PY"; echo "Press Enter"; read -r _; exit 1; }
ATTACH="${1:-0.50}"; CORE="${2:-0.64}"
"$PY" -u trope-form.py cluster --method twopass --taucore "$CORE" --tau "$ATTACH" --show 30 2>&1 | tee trope-cluster-dry.log
echo
echo "Review bands + samples + that trope-clusters.json was written, then tell Claude."
echo "Press Enter to close..."; read -r _
