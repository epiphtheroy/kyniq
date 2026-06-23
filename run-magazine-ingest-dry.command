#!/usr/bin/env bash
# ============================================================
# Metatake — Magazine ingest DRY RUN: shows exactly what the real crawl would
# seed / enable / fetch, WITHOUT writing anything to the DB. Safe to click first.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)  (DRY — no writes)"

for p in "/opt/homebrew/bin" "/usr/local/bin" "/usr/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
export PATH
PY="$(command -v python3 || true)"
[ -z "$PY" ] && { echo "✗ python3 not found."; read -r _; exit 1; }

echo "▶ would seed:";   "$PY" worker/magazine-ingest.py --seed --dry  || true
echo; echo "▶ would enable:"; "$PY" worker/magazine-ingest.py --enable rss --dry || true
echo; echo "▶ would crawl:";  "$PY" worker/magazine-ingest.py --dry
echo
echo "ℹ️  Nothing was written. Run run-magazine-ingest.command to do it for real."
echo "Press Enter to close..."; read -r _
