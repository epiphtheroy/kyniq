#!/usr/bin/env bash
# Film hero = video reel: plays the film's videos (clips first, trailer last); each starts
# at 0:07; when one ends the next auto-plays (also at 0:07), wrapping forever. YouTube
# controls on (unmute + scrub). Scroll-follow floating player docks bottom-left.
# (Uses the YouTube IFrame API to detect "ended" and seek the next clip.)
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "components/FilmHeroReel.tsx" "components/InviteVideo.tsx" "app/film/[slug]/page.tsx" "app/globals.css"
git -c core.pager=cat commit -m "Film hero video reel: clips-first playlist, auto-advance + start 0:07, scroll-follow float (bottom-left), controls on"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min). Open a multi-video film and watch it advance + dock on scroll."
echo "Press Enter to close..."; read -r _
