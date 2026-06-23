#!/usr/bin/env bash
# DRY preview of mt-recluster (meta-take merge + split + rename). NO writes.
# Shows LLM-proposed names/merges for the first 8 candidate components + the split plan.
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ DRY preview — no database writes. (uses ANTHROPIC + Supabase keys from ../.env.local)"
$PY -u mt-recluster.py --limit 8 2>&1 | tee recluster-dry.log
echo
echo "Reviewed? If the merges/renames look right, double-click run-recluster.command to APPLY."
echo "Press Enter to close..."; read -r _
