#!/usr/bin/env bash
# Deploy: admin control center + take-page full readings.
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add -A
git commit -m "feat: admin control center (metatake-era dashboard — at-a-glance stats, review queue for AI-published meta takes with approve/retire, split-candidate flags, recent-activity feed); move old Q&A queue to /admin/review. fix: take page shows full critical reading per example (was truncated at 180 chars)."
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main'."
echo "Press Enter to close..."; read -r _
