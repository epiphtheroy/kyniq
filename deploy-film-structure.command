#!/usr/bin/env bash
# ============================================================
# Metatake — film page: clear 3-layer logical structure.
#   1) Figures  — the film's elements, grouped by kind
#                 (figure kind 'trope' relabeled "Themes & motifs"
#                  so it no longer collides with the Tropes section)
#   2) Readings — cross-film critical patterns this film takes part in
#   3) Tropes   — screenwriting types this film instantiates (figure_type)
# Replaces the old mixed "Figures" block that inlined readings + tropes.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add app/film/'[slug]'/page.tsx app/globals.css
git commit -m "Film page: 3-layer structure (Figures / Readings / Tropes)

- Old 'Figures' block mixed three levels: figures, their inline readings,
  and a 'Tropes' subgroup (figure kind='trope') that collided by name with
  the separate Tropes (figure_type) section.
- Now three clear sections with one-line glosses:
    Figures  -> elements grouped by kind; kind='trope' relabeled
                'Themes & motifs'; each figure shows a '· N readings' hint.
    Readings -> distinct kind='reading' meta-takes the film takes part in,
                sorted by how many of its figures map to each.
    Tropes   -> kind='figure_type' hubs via figure_type_members, linking
                to /trope and the Tropes index.
- Added .mt-sub gloss style."
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Open any film page to see Figures / Readings / Tropes as separate sections."
echo "Press Enter to close..."; read -r _
