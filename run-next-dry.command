#!/usr/bin/env bash
# Watch next — DRY: 8편 파일럿으로 추천 품질 확인 (Sonnet, 동기 호출). 결과: worker/next-dry.md
set -uo pipefail
cd "$(dirname "$0")/worker" || { echo "worker 폴더 없음"; read -r _; exit 1; }
PY="$(command -v python3 || command -v python)"
echo "▶ Watch next DRY (8편)…"
"$PY" next-gen.py --out next-dry
echo "------"; echo "✅ 완료 → worker/next-dry.md / next-dry.json"
echo "Press Enter to close..."; read -r _
