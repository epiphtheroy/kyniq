#!/usr/bin/env bash
# Why watch — load dossiers into Supabase film_asset (upsert by film_id).
set -uo pipefail
cd "$(dirname "$0")/worker" || { echo "worker 폴더 없음"; read -r _; exit 1; }
PY="$(command -v python3 || command -v python)"
echo "▶ 미리보기(DRY)…"; "$PY" asset-load.py --dry
echo "------"; read -r -p "실제로 적재할까요? (y/N) " ans
{ [ "$ans" = "y" ] || [ "$ans" = "Y" ]; } && "$PY" asset-load.py || echo "취소."
echo "Press Enter to close..."; read -r _
