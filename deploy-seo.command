#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: provenance bylines + editor page + pre-launch noindex gate.
# Double-click: commit + push to origin/main (Vercel auto-deploy).
# NOTE: SITE_INDEXABLE is FALSE (lib/seo.ts) → the whole site is noindex until
# you flip it to true (then deploy) once figures are enriched.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Provenance bylines + editor (Wonwoo Yoon) page + pre-launch noindex gate

- per-page provenance: generated-by the Metatake method + created/updated dates +
  'editor: Wonwoo Yoon' link (no per-page authorship, an accountable-editor signal)
- /editor: Wonwoo Yoon bio + schema.org Person (E-E-A-T)
- lib/seo SITE_INDEXABLE (currently false): site-wide noindex + minimal sitemap so
  Google does not evaluate us as thin/scaled content before launch; per-page bar
  (figure needs >=3 takes) keeps thin pages noindex even after we go live"
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main' (~1-2 min)."
echo "   Site is NOINDEX until you set SITE_INDEXABLE=true in lib/seo.ts and redeploy."
echo "Press Enter to close..."; read -r _
