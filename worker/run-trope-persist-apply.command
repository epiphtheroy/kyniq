#!/usr/bin/env bash
# Trope persist — APPLY (WRITES). Retires old figure_type tropes, inserts the new critic-gated
# tropes + members + similar edges, sets takes.trope_id. Reversible via _bak_trope_* snapshot.
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "⚠️  Trope persist — APPLY (writes to the live DB)."
echo "   • retire ~1,421 old tropes + clear 45,297 old members"
echo "   • insert ~4,710 new tropes + members + ~19,765 similar edges + set takes.trope_id"
echo "   Snapshot _bak_trope_* exists → reversible."
echo
read -r -p "Type YES to proceed: " a
[ "$a" = "YES" ] || { echo "Aborted."; echo "Press Enter"; read -r _; exit 1; }
echo
$PY -u trope-persist.py --apply 2>&1 | tee trope-persist-apply.log
echo; echo "Done. Tell Claude to verify + re-embed trope hubs."
echo "Press Enter to close..."; read -r _
