#!/usr/bin/env bash
# Reception 적재: reception-all.jsonl → Supabase film_reception (영화별 교체, 멱등).
set -uo pipefail
cd "$(dirname "$0")/magazine research agent" || { echo "폴더 없음"; read -r _; exit 1; }
PY="$(command -v python3 || command -v python)"
echo "▶ 미리보기(DRY)…"; "$PY" reception-load.py --dry
echo "------"; read -r -p "실제로 적재할까요? (y/N) " ans
[ "$ans" = "y" ] || [ "$ans" = "Y" ] && "$PY" reception-load.py || echo "취소."
echo "Press Enter to close..."; read -r _
