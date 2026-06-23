#!/usr/bin/env bash
# ============================================================
# Metatake — Home hero: remove the lead paragraph.
#   The centered multi-line lead always read as ragged ("crumpled"); removed it.
#   Hero is now: kicker → H1 → search (+ clickable hints) → ask + rotating prompts.
#   File: components/AskHero.tsx   (.ah-lead CSS left in place, unused/harmless)
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

git add components/AskHero.tsx
echo "▶ Staged:"; git diff --cached --name-only

git commit -m "Home hero: remove the lead paragraph (centered multi-line read as ragged)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Hard-refresh metatake.net (Cmd+Shift+R)."
echo "Press Enter to close..."; read -r _
