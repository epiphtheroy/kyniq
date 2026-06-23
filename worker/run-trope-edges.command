#!/usr/bin/env bash
# Trope persist — EDGES ONLY (recovery): tropes are already inserted; this (re)inserts just the
# similar-trope edges (relation='similar', now allowed). Safe to re-run (on conflict do nothing).
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ Trope persist — EDGES ONLY."
$PY -u trope-persist.py --edges-only 2>&1 | tee trope-edges.log
echo; echo "Done. Tell Claude to verify edge count + re-embed."
echo "Press Enter to close..."; read -r _
