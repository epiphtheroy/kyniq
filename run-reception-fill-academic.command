#!/usr/bin/env bash
# OpenAlex 회복 후: 학술 '보류(ap)' 영화의 논문만 채워 넣음(비평 Brave는 재호출 안 함).
set -uo pipefail
cd "$(dirname "$0")/magazine research agent" || { echo "폴더 없음"; read -r _; exit 1; }
PY="$(command -v python3 || command -v python)"
echo "▶ 학술 채우기 (보류 영화만, OpenAlex)…"
"$PY" reception-run.py --fill-academic --workers 4
echo "------"; echo "✅ 완료 → reception-all.jsonl / reception-run-summary.md"
echo "Press Enter to close..."; read -r _
