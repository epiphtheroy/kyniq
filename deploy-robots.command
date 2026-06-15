#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: robots.txt opt-out of AI training bots (+ worker Opus path).
# Double-click: commit + push to origin/main (Vercel auto-deploy).
# Does NOT touch the running enrichment batch (that's a separate local process).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "robots.txt: allow search/answer bots, block AI training crawlers

- block GPTBot/ClaudeBot/Google-Extended/CCBot/Bytespider/Meta/Apple-Extended etc.
  (opt out of model-training scraping; no effect on Google/Bing search rankings)
- keep Googlebot/Bingbot + OAI-SearchBot/ChatGPT-User/PerplexityBot/Claude-Search allowed
- worker: Anthropic (Opus 4.8) model path; .gitignore worker enrichment bundles"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys; check https://metatake.net/robots.txt after ~1-2 min."
echo "Press Enter to close..."; read -r _
