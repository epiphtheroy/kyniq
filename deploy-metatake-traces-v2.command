#!/usr/bin/env bash
# v2 — robust: NO pager, commit ONLY the 5 meta-take-cleanup files (ignores the
# rest of the staged backlog so unrelated WIP can't sneak into / break the build).
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="app/director/[slug]/page.tsx"
F2="app/trending/page.tsx"
F3="app/page.tsx"
F4="components/HomeClient.tsx"
F5="components/AskHero.tsx"

git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4" "$F5"
echo "▶ committing ONLY:"
git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4" "$F5"
echo "------"
git -c core.pager=cat commit -m "Drop meta-take traces from director / trending / home (-> Strong Misreadings + frameworks)" -- "$F1" "$F2" "$F3" "$F4" "$F5"
echo "------ pushing ------"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
