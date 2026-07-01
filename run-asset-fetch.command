#!/usr/bin/env bash
# Why watch FULL — poll batches; append parsed dossiers to asset-all.jsonl. 처리 중이면 잠시 후 다시.
set -uo pipefail
cd "$(dirname "$0")/worker" || { echo "worker 폴더 없음"; read -r _; exit 1; }
PY="$(command -v python3 || command -v python)"
"$PY" asset-batch.py fetch --out asset-all
echo "------"; echo "끝나면 → 적재(asset-load) → 'Why watch' UI 배포."
echo "Press Enter to close..."; read -r _
