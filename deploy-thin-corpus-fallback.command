#!/usr/bin/env bash
# ============================================================
# Metatake AI — graceful behavior when the corpus doesn't cover the subject.
#   (A) app/api/rag/route.ts — prompt now: if the numbered corpus readings don't
#       address the question's subject (e.g. a director not in the corpus), don't
#       just refuse — acknowledge the gap in one line, then answer from the CRITIC
#       passages ([C#]); if none, point to the scholarly further reading. No fabrication.
#   (B) app/rag/_lib/criticsSearch.ts — short / bare-name queries (e.g. just a
#       director) get light film context appended so a name reliably surfaces critic
#       essays in the domain-restricted search.
#   Files: app/api/rag/route.ts, app/rag/_lib/criticsSearch.ts
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

git add app/api/rag/route.ts app/rag/_lib/criticsSearch.ts
echo "▶ Staged:"; git diff --cached --name-only

git commit -m "Metatake AI: graceful thin-corpus fallback (lead with critics/scholarship) + stronger critic search on short queries"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Bare-name queries on subjects outside the corpus"
echo "   now lean on critics + scholarship instead of refusing."
echo "Press Enter to close..."; read -r _
