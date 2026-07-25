#!/usr/bin/env bash
# CRM 총괄비서 회신 워처 — 오너 회신을 자동 감지해 최종본을 보낸다.
# 오너가 "회신했어"라고 말할 필요가 없도록 주기적으로 폴링한다(idempotent: 이미 처리한 회신은 건너뜀).
cd "$(cd "$(dirname "$0")/.." && pwd)"
INTERVAL="${CRM_WATCH_INTERVAL:-120}"
echo "[$(date)] crm-agent reply watcher up (every ${INTERVAL}s)" >> worker/crm-agent-watch.log
while true; do
  python3 worker/crm-agent.py --reply >> worker/crm-agent-watch.log 2>&1
  sleep "$INTERVAL"
done
