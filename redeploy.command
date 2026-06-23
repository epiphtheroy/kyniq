#!/usr/bin/env bash
# ============================================================
# Metatake — Force a fresh production deploy so Vercel picks up newly-added
# environment variables (e.g. ANTHROPIC_API_KEY). Vercel only applies env-var
# changes on a NEW deployment, so this pushes an empty commit to trigger the
# GitHub build — no code change.
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

git commit --allow-empty -m "Redeploy: apply ANTHROPIC_API_KEY (Claude Sonnet) to the running functions"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min) with the current env (incl. ANTHROPIC_API_KEY)."
echo "Press Enter to close..."; read -r _
