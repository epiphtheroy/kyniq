#!/bin/bash
# ============================================================
# The Film Factory — STATUS (read-only).
# Double-click me. Prints recent runs + stage_runs state;
# touches nothing (no spend, no writes).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
echo "▶ factory status (read-only)"
echo
python3 worker/factory.py status
echo
echo "✅ Done."
echo "Press Enter to close..."; read -r -n1 _
