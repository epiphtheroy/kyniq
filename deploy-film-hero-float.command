#!/usr/bin/env bash
# Film hero video upgrades: when it scrolls out of view it docks into a small floating
# player (now bottom-LEFT, not far bottom-right) so playback continues; YouTube controls
# stay on (viewer can unmute + scrub); autoplay start moved 0:05 → 0:07; loops.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "components/InviteVideo.tsx" "app/film/[slug]/page.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Film hero: scroll-follow floating player (bottom-left) + controls/sound/seek + start 0:07"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min). Open a film page, scroll down → video docks bottom-left."
echo "Press Enter to close..."; read -r _
