#!/usr/bin/env bash
# Deploy: new-home DESIGN PREVIEW (v7 mockup) at metatake.net/home2/ — static, noindex,
# excluded from middleware. Does NOT touch the live home (/). Review only.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "public/home2/" "middleware.ts"
git -c core.pager=cat commit -m "New-home design preview (v7) at /home2 — static, noindex, middleware-excluded"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min) → https://metatake.net/home2/"
echo "Press Enter to close..."; read -r _
