#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ theory-import — $(date)"
python3 theory-import.py
echo
echo "✅ Canon imported. Tell Claude to run the tradition backfill."
echo "Press Enter to close..."; read -r _
