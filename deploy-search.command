#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: in-site search v1 (keyword + fuzzy).
# Double-click: commit + push to origin/main (Vercel auto-deploy).
# DB (migration 0019: pg_trgm + indexes + search_site RPC) already applied live.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Site search v1 — keyword + fuzzy (Supabase FTS + pg_trgm)

- migration 0019: pg_trgm + GIN trgm indexes + search_site(q,limit) RPC over
  films / figures / meta-takes / directors (typo-tolerant, ranked)
- SearchBox: debounced typeahead in the nav + home hero — grouped, entity
  colour-coded, keyboard nav, '/' to focus; /search results page (SEO)
- KEPT: v2 (pgvector semantic + hybrid RRF over takes) recorded for later"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys (~1-2 min). Try the search box in the header."
echo "Press Enter to close..."; read -r _
