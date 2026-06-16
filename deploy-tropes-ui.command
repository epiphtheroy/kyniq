#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: Tropes (figure-types) UI.
# Nav: Genres → Tropes; /tropes index; /trope/[slug] hub; figure-page "Type" row.
# Reads kind='figure_type' hubs + figure_type_members (migrations 0028-0030 already live).
# Best run after stage-2 populates tropes, but safe to run now (empty states handled).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add -A
git commit -m "Tropes (figure-types): nav, /tropes index, /trope/[slug] hub, figure Type row

- meta_takes.kind discriminator (reading | figure_type); figure_type_members.
- Nav 'Genres' → 'Tropes'. /tropes lists figure-type hubs (trope_counts view).
- /trope/[slug]: members (figures) + cross-linked readings (trope_readings RPC)
  + follow/like; figure page shows its Type(s).
- Worker trope-tag.py (stage 1: film-agnostic type tags). Stage 2 (cluster+name) next."
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys (~1-2 min)."
echo "Press Enter to close..."; read -r _
