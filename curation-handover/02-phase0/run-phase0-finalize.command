#!/bin/bash
# 더블클릭하면 실행됩니다. 원산지 국가를 TMDB로 확정하고 국가 허브를 다시 세웁니다. (약 4분)
cd "$(dirname "$0")"
echo "=============================================="
echo " Metatake — Phase 0 원산지 확정 시작 (약 4분)"
echo " 창을 닫지 말고 'DONE' 메시지가 뜰 때까지 기다리세요."
echo "=============================================="
echo ""
/usr/bin/python3 phase0_finalize_via_rest.py
echo ""
echo "끝났습니다. 이 창은 이제 닫으셔도 됩니다."
