#!/bin/bash
# ============================================================
# The Film Factory — PLAN (dry, read-only).
# Double-click me. Shows the proposed stage plan for pending
# intake / the next run; touches nothing (no spend, no writes).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
echo "▶ factory plan (read-only, no spend)"
echo
python3 worker/factory.py plan
echo
echo "✅ Done."
echo "Press Enter to close..."; read -r -n1 _
