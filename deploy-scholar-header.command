#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: meta-take academic header + meaning↔device cross-link.
# (Migration 0031 + theorist backfill already live.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add -A
git commit -m "Meta-take academic header + meaning<->device cross-link

- ScholarHeader on reading pages: precise theory term (raw_concept) + lineage
  (theorist; backfilled to split children), critical-register 'lens map', outbound
  scholarship search links (Google Scholar/JSTOR/PhilPapers — searches, not generated
  citations), and the cross-film count framed as a working filmography + cite-carefully note.
- Cross-link boxes: meta_take_tropes RPC (reading -> devices) + trope_readings
  (device -> meanings); symmetric .xbox on /take and /trope (live once tropes exist).
- KEPT: recorded Tropes layer, academic header, and the next big-bang prompt checklist."
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys (~1-2 min)."
echo "Press Enter to close..."; read -r _
