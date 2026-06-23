#!/usr/bin/env bash
# ============================================================
# Metatake — search engine verification (Google + Bing).
#   • Google: <meta name="google-site-verification"> via app/layout.tsx
#   • Bing:   public/BingSiteAuth.xml served at https://metatake.net/BingSiteAuth.xml
#   After deploy: click Verify in Google Search Console AND Bing Webmaster Tools,
#   then submit sitemap.xml in each.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add app/layout.tsx public/BingSiteAuth.xml
git commit -m "SEO: Google site-verification meta tag + Bing BingSiteAuth.xml"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Then:"
echo "   • Google Search Console → Verify → submit sitemap.xml"
echo "   • Bing Webmaster Tools → Verify → submit sitemap.xml"
echo "   (check https://metatake.net/BingSiteAuth.xml loads before clicking Bing Verify)"
echo "Press Enter to close..."; read -r _
