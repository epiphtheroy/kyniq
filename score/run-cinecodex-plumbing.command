#!/bin/bash
# STEP 1 — plumbing test: score 16 films (~$0.02). Confirms the API, parser, DB writes work.
cd "$(dirname "$0")"
echo "=== Cinecodex — plumbing test (16 films) ==="
/usr/bin/python3 cinecodex_score.py 16 visible
echo ""
echo "끝났습니다. 이상 없으면 run-cinecodex-visible.command 를 실행하세요."
