#!/usr/bin/env bash
# ============================================================
# Metatake — Critics section: show only what the answer actually quotes.
#   • app/api/rag/route.ts      — after generation, keep only the critic passages the
#       answer cited via [C#]; if it quoted none, the Critics section is omitted.
#   • app/rag/_lib/quotation.ts — prompt now: when a critic passage is directly
#       relevant, include ONE short attributed quote ([C#]); else paraphrase/omit.
#   Net effect: critic quotes appear only when genuinely on-point (no 6-item rail,
#   no loosely-related / boilerplate snippets).
#   Files: app/api/rag/route.ts, app/rag/_lib/quotation.ts
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

git add app/api/rag/route.ts app/rag/_lib/quotation.ts
echo "▶ Staged:"; git diff --cached --name-only

git commit -m "/ask critics: show only passages the answer cites [C#]; prompt uses one apt quote"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Critic quotes now appear only when the answer"
echo "   actually quotes one. (Run run-magazine-recrawl.command to also de-boilerplate snippets.)"
echo "Press Enter to close..."; read -r _
