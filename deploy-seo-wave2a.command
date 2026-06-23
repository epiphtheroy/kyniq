#!/usr/bin/env bash
# Metatake — SEO Wave 2A: hub <title>s use the search phrase (meta_takes.seo_phrase)
# when present, so readings/tropes rank for "Films about/with X". Falls back to the
# current title until mt-seo-batch populates the phrases. Files: take + trope pages.
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add "app/take/[slug]/page.tsx" "app/trope/[slug]/page.tsx"
git commit -m "SEO Wave 2A: hub titles use seo_phrase ('Films about/with X') with fallback"
git push origin main
echo "✅ Pushed. Run the mt-seo batch (submit then fetch) to populate the phrases."
echo "Press Enter to close..."; read -r _
