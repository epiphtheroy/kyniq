#!/usr/bin/env bash
# Metatake — Deploy: Strong Misreadings front-end (new model).
# Stages ONLY the new-model files (figure + film pages, frameworks lib, about manifesto,
# CSS), commits, and pushes to main → Vercel rebuilds. Other locally-modified files are
# left untouched.
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
[ -f .git/index.lock ] && { echo "▶ removing stale .git/index.lock"; rm -f .git/index.lock; }
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

git add app/film app/about/page.tsx app/globals.css lib/frameworks.ts
echo "▶ staged files:"; git diff --cached --name-only
git commit -m "Strong Misreadings: new-model film + figure pages, frameworks lib, about manifesto"
git push origin main
echo
echo "✅ Pushed to main. Vercel rebuilds (~2 min). Tell Claude to verify the build + live pages."
echo "Press Enter to close..."; read -r _
