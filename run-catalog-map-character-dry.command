#!/usr/bin/env bash
# CHARACTERS DRY — classify 14 character figures (Sonnet, real-time) to sanity-check the
# new multi-label shape (identities + complexes + archetype + themes). No DB write. Cents of cost.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
if ! grep -q '^ANTHROPIC_API_KEY=' .env.local 2>/dev/null; then
  echo "⚠️  ANTHROPIC_API_KEY not found in .env.local"; echo "Press Enter to close…"; read -r _; exit 1
fi
echo "▶ CHARACTERS DRY: 14 figures × Sonnet (real-time, no DB) …"
python3 worker/catalog-map-char.py --dry --n 14 || { echo "failed"; read -r _; exit 1; }
F="Element/catalog-map-DRY-character.md"; [ -f "$F" ] && open "$F"
echo "Press Enter to close…"; read -r _
