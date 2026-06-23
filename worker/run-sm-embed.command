#!/usr/bin/env bash
# Embed the new Strong Misreadings (takes) + figures. text-embedding-3-small.
# DRY shows counts; then a YES gate before writing. Idempotent (only null embeddings).
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ Embeddings — DRY (counts only)"
$PY -u mt-embed.py --dry --only take,figure 2>&1 | tee sm-embed-dry.log
echo
read -r -p "Write embeddings to the DB? Type YES: " a
[ "$a" = "YES" ] || { echo "Aborted."; echo "Press Enter to close..."; read -r _; exit 1; }
echo
$PY -u mt-embed.py --only take,figure 2>&1 | tee sm-embed.log
echo
echo "✅ Done. Tell Claude to verify embedding coverage."
echo "Press Enter to close..."; read -r _
