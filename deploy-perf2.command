#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")"
git add -A
git commit -m "perf: generateStaticParams on dynamic routes to enable on-demand ISR caching"
git push origin main
echo; echo "✅ Pushed."; echo "Press Enter to close..."; read -r _
