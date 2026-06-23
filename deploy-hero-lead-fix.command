#!/usr/bin/env bash
# ============================================================
# Metatake — Home hero: balance the headline + lead line-breaks.
#   app/globals.css — .ah-h1 and .ah-lead get `text-wrap: balance` (even line
#   lengths, no orphan word like a lone "generated."); lead narrowed to 52ch so it
#   reads as a tidy centered block.
#   File: app/globals.css
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
git add app/globals.css
echo "▶ Staged:"; git diff --cached --name-only
git commit -m "Home hero: balanced headline + lead line-breaks (text-wrap:balance, 52ch)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). The lead now wraps as a tidy, balanced centered block."
echo "Press Enter to close..."; read -r _
