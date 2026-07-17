#!/bin/bash
# Metatake 릴리즈 버튼 — staging에서 확인한 것을 그대로 프로덕션(main)에 반영.
# 사용법: Finder에서 더블클릭 (권장 시각: 매일 22:00, 심야 백필과 비겹침).
# 로컬 작업트리는 건드리지 않는다 — 임시 worktree에서 병합 후 푸시.
set -euo pipefail
REPO="/Users/jerryje/Documents/MetaTake"
cd "$REPO"

echo "── Metatake release ──────────────────────────────"
git fetch origin staging main

echo "▶ staging: $(git log -1 --format='%h %ad %s' --date=format:'%m-%d %H:%M' origin/staging)"
echo "▶ main:    $(git log -1 --format='%h %ad %s' --date=format:'%m-%d %H:%M' origin/main)"

if git merge-base --is-ancestor origin/staging origin/main; then
  echo "✅ 반영할 변경이 없습니다 (staging이 이미 main에 포함됨)."
  read -p "엔터를 누르면 닫힙니다." _; exit 0
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

WTBASE="$(mktemp -d)"
WT="$WTBASE/release"
cleanup() { cd "$REPO"; git worktree remove --force "$WT" 2>/dev/null || true; rm -rf "$WTBASE"; }
trap cleanup EXIT

git worktree add --detach "$WT" origin/main
cd "$WT"
if ! git merge --no-ff --no-edit -m "release: staging → main $(date '+%F %H:%M')" origin/staging; then
  echo "❌ 병합 충돌 — 자동 반영 불가. Claude 세션에 '릴리즈 충돌 해결'을 요청하세요."
  read -p "엔터를 누르면 닫힙니다." _; exit 1
fi
git push origin HEAD:main
echo ""
echo "🚀 반영 완료 — Vercel이 몇 분 내 metatake.net 프로덕션을 배포합니다."
read -p "엔터를 누르면 닫힙니다." _
