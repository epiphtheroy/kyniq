#!/usr/bin/env bash
# ============================================================
# Metatake — LAUNCH. Flip SITE_INDEXABLE on (search engines may index),
# ship the expanded sitemap, and deploy.
#   * lib/seo.ts        : SITE_INDEXABLE false -> true
#   * app/sitemap.ts    : now lists /meta-takes, /tropes, /latest +
#                         all 274 readings (/take) + 439 tropes (/trope)
#
# After this, every quality page (films, figures with >=3 takes, readings,
# tropes) becomes indexable and Google can discover the corpus via the sitemap.
# This is the public launch — run it only when you're ready to go live.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

# 1) flip the master switch (idempotent; verify it actually changed)
sed -i '' 's/export const SITE_INDEXABLE = false;/export const SITE_INDEXABLE = true;/' lib/seo.ts
if ! grep -q 'export const SITE_INDEXABLE = true;' lib/seo.ts; then
  echo "✗ Could not flip SITE_INDEXABLE — line not found. Aborting."; read -r _; exit 1
fi
echo "  ✓ SITE_INDEXABLE = true"

# 2) commit + push
git add lib/seo.ts app/sitemap.ts
git commit -m "LAUNCH: SITE_INDEXABLE=true + sitemap lists readings & tropes

- Flip master index switch on; films, figures (>=3 takes), readings (/take),
  and tropes (/trope) now emit indexable robots.
- sitemap.xml now advertises /meta-takes, /tropes, /latest and every published
  reading + trope so search engines can discover the full corpus."
git push origin main
echo
echo "✅ LAUNCHED. Vercel rebuilds (~1-2 min)."
echo "   Verify after deploy:"
echo "     • https://metatake.net/robots.txt   (sitemap line present)"
echo "     • https://metatake.net/sitemap.xml   (films + readings + tropes listed)"
echo "     • View-source any film page: no 'noindex' in the robots meta tag."
echo "   Then submit https://metatake.net/sitemap.xml in Google Search Console."
echo "Press Enter to close..."; read -r _
