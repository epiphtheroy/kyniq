#!/usr/bin/env bash
# ============================================================
# Metatake — page design fixes (trope / meta-take / tropes index / film).
#  Trope page (/trope/[slug]): removed the "Using this device" box; heading now
#    "Figures of {trope name}"; film-first then figure; always expanded (no fold);
#    dropped the "Reads as" line; arrow link (no "Open" word).
#  Meta-take page (/take/[slug]): removed "The tropes that build this meaning"
#    box; right box now shows only Films + Takes.
#  Tropes index (/tropes): two-column list of titles + figure count (no blurbs).
#  Film page (/film/[slug]): trope links now look like links; "Readings" renamed
#    "Meta takes"; each meta-take and trope shows "· via {figure}" links.
#  (Does NOT include the homepage redesign or Ask v1.1 — those deploy separately.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add "app/take/[slug]/page.tsx" "app/trope/[slug]/page.tsx" app/tropes/page.tsx "app/film/[slug]/page.tsx" app/globals.css
git commit -m "Page fixes: trope page unfold+film-first+name heading, slimmer meta-take box, /tropes 2-col, film 'Meta takes' + via-figure links"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Check a trope, a meta-take, /tropes, and a film page."
echo "Press Enter to close..."; read -r _
