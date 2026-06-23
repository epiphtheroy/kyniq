#!/usr/bin/env bash
# ============================================================
# Metatake — Critics: dial up usage one notch.
#   app/rag/_lib/quotation.ts — when a critic passage directly frames the question,
#   the model now FAVOURS weaving in one short attributed quote (still omits critics
#   entirely when none is apropos; still capped + fair-use guarded). "Only-cited"
#   display is unchanged, so this adds apt quotes without bringing back noise.
#   File: app/rag/_lib/quotation.ts
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

git add app/rag/_lib/quotation.ts
echo "▶ Staged:"; git diff --cached --name-only

git commit -m "Critics: favour one apt short quote when a passage frames the question (still omit if none)"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). Apt critic quotes will surface more readily."
echo "Press Enter to close..."; read -r _
