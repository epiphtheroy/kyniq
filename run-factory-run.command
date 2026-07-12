#!/bin/bash
# ============================================================
# The Film Factory — RUN (EXECUTES stages, REAL SPEND).
# Double-click me, or pass a run id:  ./run-factory-run.command 42
# With no arg the CLI picks the current/next run.
#
# ⚠️  THIS IS NOT A DRY RUN. It executes the plan on THIS Mac,
#     including LLM (Anthropic) stages that cost real money and
#     writes live data to production Supabase. Use
#     run-factory-plan.command first to preview.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
RUN_ID="${1:-}"
echo "▶ Repo: $(pwd)"
echo
echo "⚠️  This EXECUTES factory stages on this Mac — LLM calls = REAL SPEND,"
echo "    and writes live production data. Not a dry run."
if [ -n "$RUN_ID" ]; then
  echo "▶ run id: $RUN_ID"
  python3 worker/factory.py run --run "$RUN_ID" --yes
else
  echo "▶ run id: (auto — current/next run)"
  python3 worker/factory.py run --yes
fi
echo
echo "✅ Done."
echo "Press Enter to close..."; read -r -n1 _
