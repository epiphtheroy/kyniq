#!/usr/bin/env bash
# Concept page: home v7 header (dark Nav + tinted masthead band: kicker / big title /
# native / meta / section underline) for visual continuity with the main page.
# Body (readings list) unchanged. No DB / structure change.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "components/home2/Nav.tsx" "app/home2.css" "app/idea/[slug]/page.tsx"
git -c core.pager=cat commit -m "Concept page: home v7 header (dark nav + masthead band) for continuity; body unchanged"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/idea/repetition-compulsion"
echo "Press Enter to close..."; read -r _
