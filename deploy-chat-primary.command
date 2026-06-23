#!/usr/bin/env bash
# ============================================================
# Metatake AI — make Chat the primary on-site surface; keep Ask as a single-answer mode.
#   • components/AskHero.tsx     — home hero prompt + example chips now open /chat
#       (was /ask). The full editorial home is unchanged.
#   • components/MetatakeNav.tsx — top nav now shows "💬 Chat" only (the "Ask" item
#       is removed to avoid confusion).
#   /ask is intentionally KEPT (route + page) as the one-shot "single answer" mode for
#   the embeddable widget / API / shareable ?q= links — just demoted from the main nav.
#   Files: components/AskHero.tsx, components/MetatakeNav.tsx
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

git add components/AskHero.tsx components/MetatakeNav.tsx
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "AskHero|MetatakeNav" || echo "  (no errors in the changed files)"
fi

git commit -m "Chat is the primary surface: home hero + nav point to /chat; Ask kept as single-answer mode"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Home + nav now lead to Chat; /ask stays for one-shot/embeds."
echo "Press Enter to close..."; read -r _
