#!/usr/bin/env bash
# ============================================================
# Metatake downstream 1/4 — EMBEDDINGS (takes, figures, hubs).
# OpenAI text-embedding-3-small. Idempotent; writeback is batched
# via an RPC so a dropped connection only costs one batch.
# Double-click to run. Safe to re-run if it stops mid-way.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Embeddings — $(date)"
python3 mt-embed.py
echo
echo "✅ Embeddings done (re-run safely if interrupted)."
echo "   Next: run-mt-consolidate.command"
echo "Press Enter to close..."; read -r _
