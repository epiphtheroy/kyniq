#!/usr/bin/env bash
# APPLY mt-recluster (PERSIST): merge near-duplicate hubs (LLM-confirmed), split hubs
# over 70 takes into <=70 semantic sub-hubs, rename all duplicate names uniquely,
# re-embed changed hubs, null seo_phrase for regen. Idempotent; safe to re-run.
set -uo pipefail
cd "$(dirname "$0")"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
echo "▶ PERSIST — applying merge + split + rename to ALL components."
$PY -u mt-recluster.py --persist 2>&1 | tee recluster.log
echo
echo "Done. NEXT (tell Claude): run mt-relate (differences+links), then mt-rank/mt-recommend,"
echo "the SEO fetch, and deploy the /take merged-redirect."
echo "Press Enter to close..."; read -r _
