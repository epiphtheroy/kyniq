#!/usr/bin/env bash
# ============================================================
# Metatake — surface the trope connections.
#   • Director page : adds "Signature tropes" (figure-types recurring across
#                     the filmography) + a Tropes count, alongside meta-takes.
#   • Figure page   : new "Connected figures" section — the figures from other
#                     films Metatake places alongside this one, grouped by the
#                     trope they share (so the WHY is explicit). Each links out;
#                     "+N more →" goes to the trope hub.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add "app/director/[slug]/page.tsx" "app/film/[slug]/figure/[figureSlug]/page.tsx" app/globals.css
git commit -m "Tropes everywhere: director 'Signature tropes' + figure 'Connected figures' (via shared trope)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min)."
echo "   Check: a director page (Signature tropes section) and any figure page"
echo "          (Connected figures, grouped by the shared trope)."
echo "Press Enter to close..."; read -r _
