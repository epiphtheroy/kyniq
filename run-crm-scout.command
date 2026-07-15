#!/bin/bash
# Double-click runner (operator's Mac) — CRM search bot one pass.
# Scans official Contact/Press pages in crm_sources → files crm_candidates.
# Sandbox has no internet; this runs on the Mac against the live DB.
cd "$(dirname "$0")" || exit 1
echo "=== CRM scout ==="
echo "Dry run first (no writes)…"
python3 worker/crm-scout.py --dry
echo ""
read -r -p "File candidates for real? [y/N] " ans
if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
  python3 worker/crm-scout.py
else
  echo "Skipped live run."
fi
echo ""
read -r -p "Press Enter to close…" _
