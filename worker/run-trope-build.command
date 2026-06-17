#!/usr/bin/env bash
# ============================================================
# Tropes stage 2 — cluster + NAME + create trope hubs (PERSIST, writes DB).
# Names each >=5-film cluster (Opus, batched) and creates figure_type hubs + members.
# Run the DRY version first and review the candidate list.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ trope-build PERSIST — $(date)"
echo "  ⚠ WRITES TO DB (creates trope hubs + members)."
python3 trope-build.py --persist --reset
echo
echo "✅ Tropes created. Then deploy-tropes (if not already) and check /tropes."
echo "Press Enter to close..."; read -r _
