#!/usr/bin/env bash
# Film "An invitation": two-column layout with the trailer beside the text — muted autoplay,
# lazy-mounted on scroll (LCP-safe), controls left on so the viewer can unmute. Trailer dropped
# from the info accordion when shown here (no duplication). Films without a trailer: text only.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="components/InviteVideo.tsx"
F2="app/film/[slug]/page.tsx"
F3="app/globals.css"

git -c core.pager=cat add -- "$F1" "$F2" "$F3"
echo "▶ committing ONLY:"; git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3"
echo "------"
git -c core.pager=cat commit -m "Film Invitation: trailer beside text (muted autoplay, lazy); 2-col layout"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
