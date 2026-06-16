#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: login fix + personalization.
# Double-click: commit + push to origin/main (Vercel auto-deploy).
# (Migration 0020 already applied to the live DB.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Login entry point + personalization (follow/like, /me dashboard)

- AccountMenu in nav: Sign in when logged out; username + dropdown
  (My dashboard / Public profile / Settings / Log out) when logged in.
  Fixes the wiki nav having no auth UI / no logged-in indicator.
- EntityActions (Follow 📌 + Like ♥) at the top of film, figure and
  meta-take pages. Follow = private list; Like = public count.
- /me dashboard (session-aware): Following, Liked, and My takes.
- Migration 0020: user_pins (RLS own) + public like_counts view +
  get_my_pins() RPC. /me added to middleware auth gate."
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys (~1-2 min)."
echo "Press Enter to close..."; read -r _
