#!/usr/bin/env bash
# Nav rollout to all pages: every server page now uses the shared dark SiteNav
# (expanded 5 groups + dropdowns); client pages (chat/ask/rag) use SiteNavClient.
# Plus hover-bridge fix so dropdowns don't close while moving the mouse into them.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -u
git -c core.pager=cat add components/home2/SiteNavClient.tsx
git -c core.pager=cat commit -m "Nav rollout: shared SiteNav on all pages (SiteNavClient for chat/ask/rag) + dropdown hover-bridge fix"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2-3 min). Spot-check: /director/<x>, /trope/<x>, /theorist/<x>, /idea/<x>, /tradition/<x>"
echo "Press Enter to close..."; read -r _
