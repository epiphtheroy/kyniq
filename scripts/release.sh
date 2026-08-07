#!/usr/bin/env bash
# release — put staging on main, which is what deploys production.
#
# Exists because `git push origin origin/staging:main` is one command that is
# easy to break in half: paste it with a newline after "git push origin" and the
# shell cheerfully pushes the current branch instead, reports "Everything
# up-to-date", and nothing has been released. That happened twice in a row.
# One word cannot be split.
#
#   sh scripts/release.sh          # show what would go, then ask
#   sh scripts/release.sh -y       # skip the question
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch -q origin

AHEAD=$(git log --oneline origin/main..origin/staging)
if [ -z "$AHEAD" ]; then
  echo "main is already at staging — nothing to release."
  exit 0
fi

echo "staging → main:"
echo
echo "$AHEAD" | sed 's/^/  /'
echo

# Say what the reader cannot see from the subject lines: a deploy resets the ISR
# cache, so the first request to every page renders cold. That is the reason this
# repo releases at quiet hours.
COUNT=$(echo "$AHEAD" | wc -l | tr -d ' ')
echo "$COUNT commit(s). Deploying resets the ISR cache — every page renders cold once."
echo

if [ "${1:-}" != "-y" ]; then
  # Only ask when someone can actually answer. Run from a tool or a pipe there is
  # no terminal, `read` gets EOF instantly or hangs, and the release silently
  # does not happen while the prompt sits on screen looking like it is waiting.
  if [ ! -t 0 ]; then
    echo "No terminal to confirm on — re-run with -y:"
    echo
    echo "    sh scripts/release.sh -y"
    exit 1
  fi
  printf "Release? [y/N] "
  read -r ans
  case "$ans" in [yY]*) ;; *) echo "cancelled."; exit 0 ;; esac
fi

git push origin origin/staging:main
echo
echo "pushed. Vercel is building; production follows in a few minutes."
echo "verify:  sh scripts/post-deploy-check.sh"
