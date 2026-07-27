#!/bin/bash
# Metatake 릴리즈 버튼 — staging에서 확인한 것을 그대로 프로덕션(main)에 반영.
# 사용법: Finder에서 더블클릭 (권장 시각: 매일 22:00, 심야 백필과 비겹침).
# 방식: 임시 worktree/머지/체크아웃 없이, staging을 main으로 직접(fast-forward) 푸시한다.
#       (worktree 체크아웃 `git reset --hard`가 드물게 교착되던 문제 회피 — 서버측 ref 갱신만.)
set -euo pipefail
REPO="/Users/jerryje/Documents/MetaTake"
cd "$REPO"

echo "── Metatake release ──────────────────────────────"
git fetch origin staging main

echo "▶ staging: $(git log -1 --format='%h %ad %s' --date=format:'%m-%d %H:%M' origin/staging)"
echo "▶ main:    $(git log -1 --format='%h %ad %s' --date=format:'%m-%d %H:%M' origin/main)"

# 반영할 변경이 없으면 종료.
if git merge-base --is-ancestor origin/staging origin/main; then
  echo "✅ 반영할 변경이 없습니다 (staging이 이미 main에 포함됨)."
  read -p "엔터를 누르면 닫힙니다." _; exit 0
fi

# 안전장치: main이 staging의 조상이어야 fast-forward 가능. 아니면 프로덕션에만 있는
# 커밋이 있는 분기 상태 → 직접 푸시로 반영 불가(강제푸시 금지). 수동 정리 필요.
if ! git merge-base --is-ancestor origin/main origin/staging; then
  echo "❌ main이 staging에서 분기했습니다 (fast-forward 불가)."
  echo "   프로덕션에만 있는 커밋이 있어 직접 푸시로는 반영할 수 없습니다."
  echo "   Claude 세션에 '릴리즈 분기 정리'를 요청하세요."
  read -p "엔터를 누르면 닫힙니다." _; exit 1
fi

echo ""
echo "오늘 staging에 쌓인 커밋:"
git log --oneline origin/main..origin/staging | head -30
echo ""
echo "⚠️ 스테이징 URL에서 오늘 작업분(주요 페이지·어드민)을 직접 확인하셨습니까?"
echo "   GitHub Actions(CI)가 실패했다면 이메일 알림이 와 있습니다 — 먼저 확인."
read -p "프로덕션에 반영하려면 'release' 입력: " CONFIRM
if [ "${CONFIRM}" != "release" ]; then
  echo "취소됨 — 아무것도 반영되지 않았습니다."
  read -p "엔터를 누르면 닫힙니다." _; exit 1
fi

# staging을 main으로 직접(fast-forward) 푸시 — worktree/머지/체크아웃 없음 → 교착 불가.
# 비강제(fast-forward only): 위 안전장치를 통과했으므로 항상 성공, 분기 시엔 서버가 거부.
git push origin origin/staging:refs/heads/main
echo ""
echo "🚀 반영 완료 — Vercel이 몇 분 내 metatake.net 프로덕션을 배포합니다."
echo "   main ← $(git log -1 --format='%h %s' origin/staging)"
read -p "엔터를 누르면 닫힙니다." _
