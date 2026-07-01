#!/usr/bin/env bash
# Reception 전체 실행: 전 영화(~1,935편) 발굴+추출. 동시성+재개+Brave throttle.
# 중단되면 다시 눌러도 됩니다(이미 끝난 영화는 reception_out/ 에서 건너뜀).
set -uo pipefail
cd "$(dirname "$0")/magazine research agent" || { echo "폴더 없음"; read -r _; exit 1; }
PY="$(command -v python3 || command -v python)"
echo "▶ Reception 전체 실행 시작 (~1,935편)…"
echo "  Brave 무료티어(1 req/s)라 비평 발굴이 율속됩니다 — 대략 40분~1.5시간."
echo "  중단해도 안전: 다시 실행하면 끝난 영화는 건너뜁니다."
echo "------"
"$PY" reception-run.py --workers 6
echo "------"; echo "✅ 완료 → reception-all.jsonl (DB 적재 입력) / reception-run-summary.md"
echo "Press Enter to close..."; read -r _
