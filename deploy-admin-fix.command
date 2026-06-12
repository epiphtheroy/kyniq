#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")"
git add -A
git commit -m "fix: admin login redirect loop — layout redirected /admin/login to itself when session expired; middleware already gates /admin"
git push origin main
echo; echo "✅ Pushed."; echo "Press Enter to close..."; read -r _
