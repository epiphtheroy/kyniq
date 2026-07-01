#!/usr/bin/env bash
# Fix: /idea/[slug] was 404ing because sm_concepts has RLS on with no anon policy,
# so the page's direct table select returned null. Now reads via the sm_concept_head
# security-definer RPC (also resolves canonical OR variant slugs, clean display name).
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "app/idea/[slug]/page.tsx"
git -c core.pager=cat commit -m "Concept page: read via sm_concept_head RPC (RLS-safe) + resolve canonical/variant slugs"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/idea/repetition-compulsion"
echo "Press Enter to close..."; read -r _
