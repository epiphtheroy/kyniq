#!/usr/bin/env bash
# Trope detail: "Drawn to {trope}? follow these" — 3 embedding-nearest tropes at the foot.
# DB (already applied): trope embeddings = centroid of member Strong Misreadings;
#   trope_related(slug,n) RPC returns top-N cosine-similar tropes + components + sample + sim.
# App: related section + cards CSS on /trope/[slug].
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="app/trope/[slug]/page.tsx"
F2="app/globals.css"

git -c core.pager=cat add -- "$F1" "$F2"
echo "▶ committing ONLY:"
git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2"
echo "------"
git -c core.pager=cat commit -m "Trope page: related tropes (embedding-nearest) section at the foot" -- "$F1" "$F2"
echo "------ pushing ------"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
