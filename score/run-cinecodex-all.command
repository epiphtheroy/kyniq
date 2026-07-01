#!/bin/bash
# STEP 3 — score the REST of the catalog (non-visible ~4,766, ~$6, several minutes).
# Resumable: already-scored films (the 1,935 visible) are skipped automatically.
cd "$(dirname "$0")"
echo "=== Cinecodex — Pass 1 on the full catalog (remaining films) ==="
/usr/bin/python3 cinecodex_score.py "" all
echo ""
echo "끝났습니다. 어시스턴트에게 알려 전체 분포를 확인하세요."
