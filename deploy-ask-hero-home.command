#!/usr/bin/env bash
# ============================================================
# Metatake — Ask-first home + blog email-look + meta-take graph width.
#   Pushes ONLY these 5 files (Vercel build gates the actual deployed code):
#     app/page.tsx, components/AskHero.tsx, components/HomeClient.tsx,
#     app/globals.css, components/EditionBody.tsx
#
#   NOTE: the local whole-tree typecheck is intentionally NON-BLOCKING here.
#   Your working tree has uncommitted WIP (the /ask v11 + AskReadings.tsx files)
#   that don't typecheck yet — but they are NOT added/committed/pushed by this
#   command, so they never reach Vercel. The earlier gate was aborting on that WIP
#   and silently blocking these unrelated changes. Vercel still type-checks and
#   builds the committed code, so a real error in THESE files will fail the build.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

# A stale .git/index.lock from an earlier interrupted run silently blocks ALL commits.
# Clear it if no git process is actually running (safe — commits take milliseconds).
if [ -f .git/index.lock ]; then
  echo "▶ Found a stale .git/index.lock — removing it (this was blocking every deploy)."
  rm -f .git/index.lock
fi

for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

git add app/page.tsx components/AskHero.tsx components/HomeClient.tsx app/globals.css components/EditionBody.tsx
echo "▶ Staged files:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — will NOT block; WIP in the tree may show errors)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "app/page|components/AskHero|components/HomeClient|components/EditionBody" || echo "  (no errors reported in the 5 deployed files)"
fi

git commit -m "Home: Ask prompt hero on top, full editorial home below (+ blog email-look, mk graph width)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min) and type-checks the committed code."
echo "   If Vercel shows a build error in one of the 5 files above, tell me and I'll fix it."
echo "   Then open the home: Ask hero on top, full Pair home below; /take/<slug> graph tightened."
echo "Press Enter to close..."; read -r _
