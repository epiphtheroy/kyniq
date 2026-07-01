#!/usr/bin/env bash
# Deploy: Theory Phase 3 — "Tradition" line on readings + /tradition hub & pages.
# (DB already applied via MCP: theory_canon embeddings, canon_theorist bridge, take_canon
#  match (5,552 readings), slugs + canon_index/canon_readings/take_traditions RPCs.)
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "app/tradition/page.tsx" "app/tradition/[slug]/page.tsx" \
  "app/film/[slug]/figure/[figureSlug]/page.tsx" \
  "app/idea/page.tsx" "app/theorist/page.tsx" "app/globals.css" \
  "worker/theory-canon-embed.py" "worker/run-theory-canon-embed.command" "worker/run-theory-canon-embed-dry.command"
git -c core.pager=cat commit -m "Theory Phase 3: tradition line on readings + /tradition hub/pages (canon embedding match)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
