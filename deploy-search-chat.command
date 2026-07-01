#!/usr/bin/env bash
# Search/chat alignment to the new model + the perf/SEO batch, in one deploy.
# (Supersedes deploy-perf-seo.command — includes all of it.)
# UI ships FIRST; the two RPC migrations (search_site take-branch, ask_retrieve trope citation)
# are applied right AFTER this build goes live, so old UI never meets new data shapes.
#  - perf/SEO: home_bundle_cached; /strong-misreadings sitemap + canonical/og; Trending/Latest tz.
#  - search:  SearchBox kind 'reading' (Strong Misreadings) → figure page; drop dead 'meta_take'.
#  - chat/ask: meta citations link to /trope (not retired /take); "Tropes to pull".
set -uo pipefail
cd "$(dirname "$0")"
export GIT_PAGER=cat PAGER=cat
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH

F1="app/page.tsx"
F2="app/sitemap.ts"
F3="app/trending/page.tsx"
F4="app/latest/page.tsx"
F5="app/strong-misreadings/[fw]/page.tsx"
F6="components/SearchBox.tsx"
F7="app/chat/page.tsx"
F8="app/ask/page.tsx"
F9="app/rag/_components/AskReadings.tsx"
F10="app/globals.css"

git -c core.pager=cat add -- "$F1" "$F2" "$F3" "$F4" "$F5" "$F6" "$F7" "$F8" "$F9" "$F10"
echo "▶ committing ONLY:"
git -c core.pager=cat diff --cached --name-only -- "$F1" "$F2" "$F3" "$F4" "$F5" "$F6" "$F7" "$F8" "$F9" "$F10"
echo "------"
git -c core.pager=cat commit -m "Search/chat on new model (Strong Misreadings in search; /trope citations) + perf/SEO (home cache, sitemap, tz)"
git -c core.pager=cat push origin main
echo "✅ pushed. Vercel builds (~2 min). Tell Claude — it applies the 2 RPC migrations right after."
echo "Press Enter to close..."; read -r _
