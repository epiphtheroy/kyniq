#!/usr/bin/env bash
# ============================================================
# Metatake — /ask: restore the "Further reading — beyond the corpus" (academic) rail.
#   /api/rag already returns `further_reading` (OpenAlex/Crossref/Semantic Scholar),
#   but the promoted /ask page wasn't rendering it (the old /rag page did). This wires
#   the existing FurtherReading component into /ask, so scholarly links show again
#   under their own labeled, link-out-only section (never cited as corpus [n]).
#   File: app/ask/page.tsx
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

git add app/ask/page.tsx components/MetatakeNav.tsx
echo "▶ Staged:"; git diff --cached --name-only

git commit -m "/ask: render academic Further reading rail; remove RAG from top nav (folded into Ask)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). /ask now shows the academic 'Further reading' rail again."
echo "Press Enter to close..."; read -r _
