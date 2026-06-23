#!/usr/bin/env bash
# Trope formation — TAU SWEEP (method=twopass: leader cores + edge-absorb; no blob).
# Sweep value = tau_attach (how aggressively isolated readings join the nearest core).
# Embeddings load once; cores at tau_core computed once and reused. No LLM.
set -uo pipefail
cd "$(dirname "$0")"
PY="$HOME/.metatake-venv/bin/python3"; [ -x "$PY" ] || PY=python3
echo "▶ Trope formation — TAU SWEEP (twopass).  python: $PY"
"$PY" -c 'import numpy' 2>/dev/null || { echo "❌ numpy missing in $PY"; echo "Press Enter"; read -r _; exit 1; }
CORE="${2:-0.64}"
"$PY" -u trope-form.py sweep --method twopass --taucore "$CORE" --taus "${1:-0.46,0.50,0.54,0.58,0.62}" 2>&1 | tee trope-sweep.log
echo
echo "Paste the table to Claude.  (Args: \$1 = attach list, \$2 = tau_core; defaults 0.46..0.62 / 0.64)"
echo "Press Enter to close..."; read -r _
