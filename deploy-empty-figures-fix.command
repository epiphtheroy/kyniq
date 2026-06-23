#!/usr/bin/env bash
# Deploy: hide empty (no-reading) figures — film page drops 0-reading figures; figure page for a
# 0-reading figure redirects to the film. Figure kicker shows the kind (Character/Theme…), not
# the ambiguous "Figure · Trope".
set -uo pipefail
cd "$(dirname "$0")"
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git add "app/film/[slug]/page.tsx" "app/film/[slug]/figure/[figureSlug]/page.tsx"
echo "▶ staged:"; git diff --cached --name-only
git commit -m "Hide no-reading figures (film list drops them; figure page redirects to film); figure kicker shows kind not 'Figure · Trope'"
git push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
