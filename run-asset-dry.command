#!/usr/bin/env bash
# Why watch — DRY: 8편 파일럿으로 도시에 품질/사실 정확성 확인 (Opus 4.8, 캐싱). 결과: worker/asset-dry.md
set -uo pipefail
cd "$(dirname "$0")/worker" || { echo "worker 폴더 없음"; read -r _; exit 1; }
PY="$(command -v python3 || command -v python)"
echo "▶ Why watch DRY (8편, Opus 4.8)…"
"$PY" asset-gen.py --out asset-dry
echo "------"; echo "✅ 완료 → worker/asset-dry.md / asset-dry.json"
echo "Press Enter to close..."; read -r _
