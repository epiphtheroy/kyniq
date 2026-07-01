#!/usr/bin/env bash
# /film + /director index pages → new model.
# DB: films_featured / directors_featured rewritten (picks gate on live published takes /
#   signature tropes; readings counted from takes; reading-hub lists dropped) — already applied.
# App: FilmsIndex "Meta takes" column -> "Strong Misreadings" (via figure links); DirectorsIndex
#   "Meta takes" stat -> "Readings", drop dead signature-readings column, keep signature tropes;
#   page filters repointed to live data; single-column CSS.
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="app/film/page.tsx"
F2="app/director/page.tsx"
F3="components/indexes/FilmsIndex.tsx"
F4="components/indexes/DirectorsIndex.tsx"
F5="app/globals.css"

git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4" "$F5"
echo "▶ committing ONLY:"
git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4" "$F5"
echo "------"
git -c core.pager=cat commit -m "Index pages (/film, /director): featured decks + stats on new model (Strong Misreadings + tropes), drop meta-take labels" -- "$F1" "$F2" "$F3" "$F4" "$F5"
echo "------ pushing ------"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
