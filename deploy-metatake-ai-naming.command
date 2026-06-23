#!/usr/bin/env bash
# ============================================================
# Metatake — Name the product "Metatake AI" + nav label "💬 Chat".
#   • components/MetatakeNav.tsx — top-nav item relabeled "Ask" → "💬 Chat"
#       (route stays /ask).
#   • app/ask/page.tsx — hero title "Ask Metatake" → "Metatake AI".
#   (Home SEO hero left unchanged.)
#   Files: components/MetatakeNav.tsx, app/ask/page.tsx
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

git add components/MetatakeNav.tsx app/ask/page.tsx
echo "▶ Staged:"; git diff --cached --name-only

git commit -m "Name product Metatake AI; nav label → 💬 Chat (route stays /ask)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Nav shows '💬 Chat'; the page hero reads 'Metatake AI'."
echo "Press Enter to close..."; read -r _
