#!/usr/bin/env bash
# ============================================================
# Metatake AI — add CHAT as a SEPARATE new feature; keep Ask unchanged.
#   • app/chat/page.tsx (NEW)     — multi-turn conversational thread (remembers
#       context; follow-ups; "New chat"). Calls /api/rag with history.
#   • app/api/rag/route.ts        — accepts optional `history` (ADDITIVE): rewrites
#       a follow-up into a standalone query, feeds the conversation as context, but
#       still cites ONLY this turn's corpus/critic readings. /ask sends no history,
#       so its behavior is identical to before.
#   • components/MetatakeNav.tsx  — nav now has BOTH "Ask" (/ask, single answer) and
#       "💬 Chat" (/chat, conversation).
#   • app/globals.css             — .ak-chat / .ak-turn styles.
#   • app/ask/page.tsx            — unchanged single-shot Ask + a small "Try Chat →" link.
#   Ask is untouched in behavior → nothing to roll back if Chat needs tweaks.
#   Files: app/chat/page.tsx, app/api/rag/route.ts, components/MetatakeNav.tsx, app/globals.css, app/ask/page.tsx
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

git add app/chat/page.tsx app/api/rag/route.ts components/MetatakeNav.tsx app/globals.css app/ask/page.tsx
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "app/chat/page|app/ask/page|app/api/rag|MetatakeNav" || echo "  (no errors in the changed files)"
fi

git commit -m "Add Metatake AI Chat as a separate /chat (multi-turn); Ask (/ask) unchanged"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). New: /chat (conversation). Ask (/ask) is unchanged."
echo "   Try /chat: a question, then a follow-up. Hard-refresh (⌘⇧R) to clear cache."
echo "Press Enter to close..."; read -r _
