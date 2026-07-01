#!/usr/bin/env bash
# Watch next FULL — poll batches; for ended ones, append parsed recs to next-all.jsonl.
# 배치가 아직 처리 중이면 잠시 후 다시 실행하세요.
set -uo pipefail
cd "$(dirname "$0")/worker" || { echo "worker 폴더 없음"; read -r _; exit 1; }
PY="$(command -v python3 || command -v python)"
"$PY" next-batch.py fetch --out next-all
echo "------"; echo "끝나면 → 해소(next-resolve) → 적재(next-load) 단계로."
echo "Press Enter to close..."; read -r _
