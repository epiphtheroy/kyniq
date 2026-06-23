#!/usr/bin/env bash
# ============================================================
# Metatake — SEO Wave 2D: /concept canonical-term layer.
#   NEW pages built from meta_takes.tradition (normalized), via concept_index() /
#   concept_readings() RPCs (already live, migration 0053):
#     • /concept           — index of ~28 critical concepts (>=3 readings each)
#     • /concept/[slug]     — "{Concept} in film — meaning & examples" + the readings
#   "Concepts" added to the top nav. Sitemap lists them. Targets searchable academic
#   terms (the uncanny, the gaze, commodity fetishism, unreliable narration, …).
#   Files: app/concept/page.tsx, app/concept/[slug]/page.tsx,
#          components/MetatakeNav.tsx, app/sitemap.ts
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add app/concept/page.tsx "app/concept/[slug]/page.tsx" components/MetatakeNav.tsx app/sitemap.ts
git commit -m "SEO Wave 2D: /concept canonical-term layer (index + detail) + Concepts nav + sitemap"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open /concept, then /concept/the-uncanny."
echo "Press Enter to close..."; read -r _
