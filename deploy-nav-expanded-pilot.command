#!/usr/bin/env bash
# Expanded nav (home + film-detail pilot): the 5 top groups (Watch/Wander/Ideas/Lenses/You)
# show inline with the search box; each opens a dropdown on hover; narrow widths collapse
# to one "Menu" hamburger (full mega). Film detail page swaps MetatakeNav → shared SiteNav
# (dark home bar), body stays white. nav_counts() RPC already applied.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat GIT_LITERAL_PATHSPECS=1
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git -c core.pager=cat add -- \
  "components/home2/Nav.tsx" "components/home2/SiteNav.tsx" "components/home2/HomeV2.tsx" \
  "components/FilmTabBar.tsx" "app/home2.css" "app/film/[slug]/page.tsx"
git -c core.pager=cat commit -m "Expanded nav: 5 groups inline + per-group dropdown; shared SiteNav on film detail (pilot)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "   Home: https://metatake.net/   ·   Film pilot: https://metatake.net/film/dogville-2003"
echo "Press Enter to close..."; read -r _
