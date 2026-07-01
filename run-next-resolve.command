#!/usr/bin/env bash
# Watch next — resolve recs to DB films (+ TMDB verify). next-all.jsonl → next-all.resolved.jsonl
set -uo pipefail
cd "$(dirname "$0")/worker" || { echo "worker 폴더 없음"; read -r _; exit 1; }
PY="$(command -v python3 || command -v python)"
echo "▶ 해소 (DB 매칭 + TMDB 검증)…"
"$PY" next-resolve.py
echo "------"; echo "✅ → worker/next-all.resolved.jsonl · 다음: run-next-load.command"
echo "Press Enter to close..."; read -r _
