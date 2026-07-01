#!/usr/bin/env bash
# Watch next FULL — build requests for all films + submit batch(es) to Anthropic.
set -uo pipefail
cd "$(dirname "$0")/worker" || { echo "worker 폴더 없음"; read -r _; exit 1; }
PY="$(command -v python3 || command -v python)"
echo "▶ 요청 생성 (전 영화, 이미 된 건 건너뜀)…"
"$PY" next-gen.py --emit-requests --all --out next-all
echo "▶ 배치 제출…"
"$PY" next-batch.py submit --out next-all
echo "------"; echo "✅ 제출 완료. 잠시 후 run-next-fetch.command 로 결과 받기."
echo "Press Enter to close..."; read -r _
