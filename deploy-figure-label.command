#!/usr/bin/env bash
# Figure page label: kicker = "Figure" (always); show "Kind: …" only for reliable concrete kinds
# (Character/Object/Location/Form). Hide the old mis-applied 'trope'→"Theme / motif" tag.
set -uo pipefail
cd "$(dirname "$0")"
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git add "app/film/[slug]/figure/[figureSlug]/page.tsx"
echo "▶ staged:"; git diff --cached --name-only
git commit -m "Figure page: kicker = 'Figure'; show Kind only for concrete kinds, hide mis-applied trope/Theme-motif tag"
git push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
