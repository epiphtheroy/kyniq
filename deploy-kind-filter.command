#!/usr/bin/env bash
# ============================================================
# Metatake — fix: keep tropes out of the readings (meta-take) surfaces.
# Adds kind='reading' filters on /meta-takes, home, /latest, /take, figure & film
# pages; search now lists tropes as their own group routing to /trope.
# (RPCs random/trending/search/seq_nav already updated server-side.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add -A
git commit -m "Separate tropes from readings: kind='reading' filters + trope search group

- figure_type tropes were leaking into /meta-takes, home, /latest, /take loader,
  figure contribute dropdown, film 'connected' list — all now filter kind='reading'.
- search_site returns tropes as kind='trope' → SearchBox & /search route to /trope.
- random_meta_take / trending / seq_nav scoped to readings (server-side)."
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). /meta-takes now shows readings only; tropes live under Tropes."
echo "Press Enter to close..."; read -r _
