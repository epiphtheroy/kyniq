#!/usr/bin/env bash
# Reception 스모크: 앞 60편으로 프로덕션 워커(동시성+재개+Brave throttle) 검증.
set -uo pipefail
cd "$(dirname "$0")/magazine research agent" || { echo "폴더 없음"; read -r _; exit 1; }
PY="$(command -v python3 || command -v python)"
echo "▶ Reception 스모크 (60편)…"
"$PY" reception-run.py --limit 60 --workers 6
echo "------"; echo "✅ 완료 → reception-run-summary.md / reception-all.jsonl"
echo "Press Enter to close..."; read -r _
