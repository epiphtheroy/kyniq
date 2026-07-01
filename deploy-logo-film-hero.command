#!/usr/bin/env bash
# (1) Logo vertically centered in its red box (text no longer sits at the bottom).
# (2) Film page hero: the cropped backdrop becomes the trailer playing muted from 0:05,
#     in a full 16:9 frame (whole video visible). Films without a trailer keep the image.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- "app/home2.css" "app/globals.css" "app/film/[slug]/page.tsx"
git -c core.pager=cat commit -m "Logo vertical-center; film hero = muted autoplay trailer (start 0:05) in full 16:9; drop duplicate invitation trailer (preserved, disabled)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min). Check the logo + a film page hero (e.g., /film/dogville-2003)."
echo "Press Enter to close..."; read -r _
