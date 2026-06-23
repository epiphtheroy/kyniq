#!/usr/bin/env bash
# ============================================================
# Metatake — Home hero: expand the kicker + remove the lead.
#   • Kicker is now one line: "A critical map of cinema — read film by film,
#     figure by figure". The brand label stays accent-red; the continuation is a
#     calmer ink-soft tone (.ah-kick-cont) so it doesn't read as a wall of red.
#   • The ragged lead paragraph stays removed.
#   Files: components/AskHero.tsx, app/globals.css
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

git add components/AskHero.tsx app/globals.css
echo "▶ Staged:"; git diff --cached --name-only

git commit -m "Home hero: expand kicker (film by film, figure by figure); keep lead removed"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Hard-refresh metatake.net (Cmd+Shift+R)."
echo "Press Enter to close..."; read -r _
