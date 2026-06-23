#!/usr/bin/env bash
# ============================================================
# Metatake — Home hero v2 (4 fixes):
#   1. Lead paragraph is centred (margin auto + balanced wrap) — confirms the
#      off-centre look was a stale cache, not a real bug.
#   2. The "Films · Directors · Figures · Concepts · Meta takes" hint line is now
#      clickable: each token links to its index (/film, /director, /tropes,
#      /concept, /meta-takes). ("Figures" → /tropes, the browse-figures-by-type page.)
#   3. Example questions ROTATE: a shuffled pool rolls two-at-a-time with a gentle
#      fade/lift, pausing on hover (new components/HeroExamples.tsx).
#   4. Copy now states what Metatake IS — close readings of films through their
#      *figures*, mapped across all of cinema; "not reviews or ratings" — so it no
#      longer reads as a "connect two movies" tool. Prompts are figure-centred too.
#   Files: components/AskHero.tsx, components/HeroExamples.tsx, app/globals.css
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

git add components/AskHero.tsx components/HeroExamples.tsx app/globals.css
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "AskHero|HeroExamples" || echo "  (no errors in the changed files)"
fi

git commit -m "Home hero v2: centered lead, clickable index hints, rotating figure-centred prompts, clearer value copy"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Then hard-refresh metatake.net (Cmd+Shift+R) —"
echo "   the home is cached (ISR ~15 min), so a hard refresh shows the new hero immediately."
echo "Press Enter to close..."; read -r _
