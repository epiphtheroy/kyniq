#!/usr/bin/env bash
# Concept layer rebuilt on the new model (RPCs already applied in Supabase): /concept now lists
# concepts from takes.concept grouped into tropes, detail links to /trope, and the Archetype hub's
# Concept card shows real counts + top concepts.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="app/catalog/page.tsx"
F2="app/concept/[slug]/page.tsx"

git -c core.pager=cat add -- "$F1" "$F2"
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2"
echo "------"
git -c core.pager=cat commit -m "Concept layer on new model: /concept detail → /trope; Archetype hub Concept card populated"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min). /concept + the Concept card are now live."
echo "Press Enter to close..."; read -r _
