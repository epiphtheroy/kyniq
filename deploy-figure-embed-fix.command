#!/usr/bin/env bash
# CRITICAL FIX: figure pages showed "No readings yet" for figures that DO have readings.
# Cause: adding takes.trope_id (a 2nd FK to meta_takes) made the PostgREST embed
# `meta_take:meta_takes(...)` ambiguous, so the figure/me/director take queries failed.
# Fix: figure page drops the now-unused meta_take embed; me/director disambiguate the FK.
# Also: figure stat strip drops dead "Meta takes", renames Takes→Readings.
set -uo pipefail
cd "$(dirname "$0")"
[ -f .git/index.lock ] && rm -f .git/index.lock
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi
export PATH
git add "app/film/[slug]/figure/[figureSlug]/page.tsx" components/detail/FigureDetailBits.tsx app/me/page.tsx "app/director/[slug]/page.tsx"
echo "▶ staged:"; git diff --cached --name-only
git commit -m "Fix figure pages showing no readings: drop ambiguous meta_takes embed (2nd FK trope_id); disambiguate me/director; figure stats Takes→Readings, drop Meta takes"
git push origin main
echo "✅ pushed. Vercel builds (~2 min)."
echo "Press Enter to close..."; read -r _
