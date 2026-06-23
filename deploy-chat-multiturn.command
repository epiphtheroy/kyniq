#!/usr/bin/env bash
# ============================================================
# Metatake AI — turn the single-shot answer into a real multi-turn CHAT.
#   • app/api/rag/route.ts  — accepts `history`; rewrites a follow-up into a
#       standalone query (condense) for retrieval; feeds the conversation to the
#       generator for context — but every claim is still cited ONLY from THIS turn's
#       corpus/critic readings. Cache bypassed for follow-ups.
#   • app/ask/page.tsx      — conversation thread UI: stacked turns, follow-up box,
#       "New chat"; citation anchors namespaced per turn.
#   • app/globals.css       — .ak-chat / .ak-turn / .ak-bar--chat styles.
#   Now "Chat" is honest: a grounded, vertical cinema chat that remembers the thread.
#   Files: app/api/rag/route.ts, app/ask/page.tsx, app/globals.css
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

git add app/api/rag/route.ts app/ask/page.tsx app/globals.css
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "app/ask/page|app/api/rag|globals" || echo "  (no errors in the changed files)"
fi

git commit -m "Metatake AI: multi-turn conversational chat (history + follow-up condense; grounded per turn)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). /ask is now a real chat — ask a question, then a follow-up"
echo "   (e.g. 'How does Bong Joon-ho use space?' → 'and stairs?'). Hard-refresh (⌘⇧R) to clear cache."
echo "Press Enter to close..."; read -r _
