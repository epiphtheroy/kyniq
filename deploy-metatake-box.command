#!/usr/bin/env bash
# ============================================================
# Metatake — meta-take page right rail + tropes box cleanup.
#   • The two right-hand boxes ("Meta take" info + the academic header) are
#     merged into ONE box, with the duplicated film count removed.
#   • The in-body box now reads "The tropes that build this meaning" with a
#     one-line gloss, and each row says "→ trope" so it's clear it links to a
#     trope page. It also clears the right rail so the two never overlap.
#   • Google Scholar / JSTOR / PhilPapers links are now grey, turning red on hover.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add "app/take/[slug]/page.tsx" components/ScholarHeader.tsx app/globals.css
git commit -m "Meta-take page: merge right boxes (dedupe), clarify tropes box (+ no overlap), grey scholarship links"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open any /take page:"
echo "   one right box, the 'tropes' box clearly links to trope pages and no longer overlaps,"
echo "   and the scholarship links are grey (red on hover)."
echo "Press Enter to close..."; read -r _
