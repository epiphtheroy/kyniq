#!/usr/bin/env bash
# FilmCurio — Frame layer vertical slice deploy.
# Commits the frame hub page (/frame/[slug]), the leaf-page frame module,
# migration 0011, frame worker scripts, IA plan + discovery artefacts,
# and pushes to origin/main (Vercel auto-deploy).
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
echo
git status --short
echo
git add -A
git commit -m "feat: frame layer vertical slice — /frame/[slug] hub (editorial ranking + craft block + ItemList JSON-LD), 'one of cinema's big questions' module on question pages, migration 0011 (frames/tags/pgvector), frame discovery/import/classify/rank workers, site IA plan"
echo
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys from 'main'."
echo "Press Enter to close..."; read -r _
