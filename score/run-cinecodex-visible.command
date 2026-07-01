#!/bin/bash
# STEP 2 — score ALL visible films (~1,935, ~$2–4, a few minutes). Resumable: re-run to finish leftovers.
cd "$(dirname "$0")"
echo "=== Cinecodex — Pass 1 on all visible films ==="
/usr/bin/python3 cinecodex_score.py "" visible
echo ""
echo "끝났습니다. 어시스턴트에게 알려 분포를 검수(게이트)하세요."
