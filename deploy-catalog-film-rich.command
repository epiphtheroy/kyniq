#!/usr/bin/env bash
# Deploy: richer catalog (non-curated) film pages — backdrop + ratings/where-to-watch + Lineage
# + Recommended by + Gallery tab, when that data exists. Shared FilmTopInfo/FilmLineageSection/
# FilmRecommendedBy components (full page refactored to use them too).
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "components/FilmTopInfo.tsx" "components/FilmLineageSection.tsx" "components/FilmRecommendedBy.tsx" \
  "app/film/[slug]/page.tsx"
git -c core.pager=cat commit -m "Catalog film pages: backdrop + ratings/watch + Lineage + Recommended by + Gallery (shared components)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
