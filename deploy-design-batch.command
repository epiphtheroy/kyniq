#!/usr/bin/env bash
# ============================================================
# Metatake — design/UX batch (post-launch). Ships:
#   • /about     — full v2 manifesto (greeting, thesis subtitle, embeddings
#                  section + tech note, gratitude, Wonwoo Yoon byline).
#   • home       — thesis hero, Tropes section, real reading-text snippets.
#   • nav        — Tropes promoted; Meta takes moved to the end.
#   • /tropes    — one-trope-per-line list (compact, scannable).
#   • Latest     — adds "New tropes"; Trending adds "Most widespread tropes".
#   • /me        — followed/liked tropes now route to /trope (DB RPC already live).
#   • meta-take  — ScholarHeader is now a right-rail box under the info box;
#                  its "Read through" register counts are links (→ /meta-takes
#                  grouped by register, anchored).
#   • film page  — ALSO includes the crash hotfix (load() returns readings+tropes),
#                  so this single deploy restores film pages too.
# (Site is already launched; this is a normal content/UX deploy.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add \
  app/film/'[slug]'/page.tsx \
  app/about/page.tsx \
  app/page.tsx \
  app/me/page.tsx \
  app/meta-takes/page.tsx \
  app/tropes/page.tsx \
  app/latest/page.tsx \
  app/trending/page.tsx \
  components/MetatakeNav.tsx \
  components/ScholarHeader.tsx \
  app/globals.css
git commit -m "Design batch: about v2, home tropes+text, nav reorder, trope line-list, latest/trending tropes, scholar right-rail, /me trope routing"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min)."
echo "   Check: home (Tropes section + reading snippets), /about, /tropes (line list),"
echo "          /latest + /trending (trope sections), any /take page (right-rail header),"
echo "          and follow a trope then open /me (should link to /trope)."
echo "Press Enter to close..."; read -r _
