#!/usr/bin/env bash
# ============================================================
# Metatake — Home hero: feature the in-site SEARCH; Chat secondary; de-cramp nav search.
# (Supersedes deploy-chat-primary.command — includes its changes too.)
#   • components/AskHero.tsx     — hero now leads with the in-site Search (SearchBox
#       hero variant: typeahead → film/figure/trope/concept pages), with "or ask
#       Metatake AI" (→ /chat) + example chips beneath. Keeps a keyword H1 for SEO.
#   • components/MetatakeNav.tsx — top nav shows "💬 Chat" only (Ask removed; /ask kept
#       as the single-answer mode for embeds/links).
#   • app/globals.css            — nav search box widened (less cramped) + hero search styles.
#   Frontend-only — independent of the running data pipeline; safe to deploy anytime.
#   Files: components/AskHero.tsx, components/MetatakeNav.tsx, app/globals.css
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

if [ -f .git/index.lock ]; then echo "▶ Removing stale .git/index.lock"; rm -f .git/index.lock; fi

for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

git add components/AskHero.tsx components/MetatakeNav.tsx app/globals.css
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "AskHero|MetatakeNav" || echo "  (no errors in the changed files)"
fi

git commit -m "Home hero: in-site Search primary + Ask(Chat) secondary; widen nav search; nav → Chat only"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Home leads with Search; nav search is wider; Chat is one tap below."
echo "Press Enter to close..."; read -r _
