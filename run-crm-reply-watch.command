#!/usr/bin/env bash
# 더블클릭하면 CRM 총괄비서 회신 워처를 백그라운드로 상주 실행.
cd "$(dirname "$0")"
if pgrep -f "crm-agent-watch.sh" >/dev/null; then
  echo "이미 실행 중입니다 (pid $(pgrep -f crm-agent-watch.sh | tr '\n' ' '))."
else
  nohup bash worker/crm-agent-watch.sh >/dev/null 2>&1 &
  echo "CRM 회신 워처 시작됨 (pid $!). 로그: worker/crm-agent-watch.log"
fi
