#!/usr/bin/env bash
# ============================================================
# Metatake — fix nav links redirecting to login.
#   middleware.ts gated "/ask" (should be public) and its loose startsWith("/me")
#   match also caught "/meta-takes". Now: /ask + /meta-takes are public; only
#   /settings, /me, /ask/new require login (segment-exact match).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add middleware.ts
git commit -m "Fix auth gate: /ask + /meta-takes public (segment-exact match; only /me,/settings,/ask/new need login)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Then Ask and Meta takes open without login."
echo "Press Enter to close..."; read -r _
