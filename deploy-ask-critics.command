#!/usr/bin/env bash
# ============================================================
# Metatake — /ask: render the magazine CRITIC quotes section.
#   The RAG route already returns a `critics` array (short, attributed magazine
#   snippets) but the /ask page wasn't showing them. This adds:
#     • a "Critics" section under Sources — each quote + "— author, outlet, year"
#       + a link out to the original article (fair-use attribution/link-out).
#     • [C#] markers in the answer now link to that section (distinct from corpus [n]).
#   (The DB fix that actually makes quotes appear — magazine_retrieve VOLATILE — is
#    already applied server-side.)
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

git add app/ask/page.tsx
echo "▶ Staged:"; git diff --cached --name-only

git commit -m "/ask: render attributed magazine critic quotes (+ [C#] links) under Sources"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). When a crawled critic article is relevant to a"
echo "   question, /ask now shows the short quote with its author/outlet + a link to the source."
echo "Press Enter to close..."; read -r _
