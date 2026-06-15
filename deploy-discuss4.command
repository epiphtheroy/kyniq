#!/usr/bin/env bash
# ============================================================
# Metatake — deploy the "4 discussion items" batch.
# Double-click: commit everything and push to origin/main (Vercel auto-deploy).
# DB changes (migration 0016, pitch-hide, PotD overview) were already applied live.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Meta-take UX: takes vocab, foldered examples, index facets, view counter

- figure page: 'Readings' -> 'Takes' + take/meta-take gloss
- take detail: drop stale example-laden essay paragraph (keep neutral thesis)
- take detail: keep Defining/Unexpected highlights + exhaustive foldered
  'All takes' section with genre/register toggle (collapsible folders)
- meta-takes index: replace By-theory/By-genre tabs with group=family|register|theorist
  + sort=films|views|new (drop film-genre facet, which is a film attribute)
- migration 0016: meta_takes.view_count + increment_meta_take_views RPC
  + meta_take_register_counts view; ViewBeacon client counter (session-deduped)
- film page: remove AI 'pitch' editorial paragraph (matches clean layout)
- tmdb-fetch worker: also backfill films.overview + genres (no more PotD gaps)
- Vercel Web Analytics (@vercel/analytics) wired (fixes 0-visitors; still needs
  the Web Analytics 'Enable' toggle in the Vercel dashboard)"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "Press Enter to close..."; read -r _
