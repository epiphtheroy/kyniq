#!/usr/bin/env bash
# Reception 파일럿: 20편의 비평/논문 코멘트를 발굴+추출(무료 API, LLM 0, 비용 $0).
# 결과: magazine research agent/reception-pilot-summary.md  +  pilot_<slug>_enriched.csv
set -uo pipefail
cd "$(dirname "$0")/magazine research agent" || { echo "폴더를 찾지 못했습니다"; read -r _; exit 1; }

PY="$(command -v python3 || command -v python)"
[ -z "$PY" ] && { echo "python3 가 필요합니다"; read -r _; exit 1; }

echo "▶ Reception 파일럿 발굴+추출 시작 (20편, 무료 API)…"
echo "  네트워크가 필요하고 ~3–8분 걸립니다 (매 fetch마다 예의상 대기)."
echo "------"
"$PY" reception-discover.py
echo "------"
echo "✅ 완료. 검토용 요약:"
echo "   $(pwd)/reception-pilot-summary.md"
echo "Press Enter to close..."; read -r _
