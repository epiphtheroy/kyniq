#!/usr/bin/env bash
# Deploy: trope hub on new model (maturity badge + Strong-Misreading readings) + footer links.
set -uo pipefail
cd "$(dirname "$0")"
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git add app/trope components/Footer.tsx app/globals.css
echo "▶ staged:"; git diff --cached --name-only
git commit -m "Trope hub: maturity badge + Strong-Misreading readings; footer new-model links"
git push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
