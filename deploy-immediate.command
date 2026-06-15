#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: community takes publish immediately.
# Double-click: commit everything and push to origin/main (Vercel auto-deploy).
# DB policy (migration 0017) was already applied live via connector.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Community takes publish immediately

- contribution form inserts status=published (live on submit, no pre-review)
- migration 0017: takes insert policy allows status=published for human authors
- human takes get a 'Community' badge on the figure page (transparency)"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "Press Enter to close..."; read -r _
