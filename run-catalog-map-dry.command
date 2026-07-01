#!/usr/bin/env bash
# Catalog mapping DRY — classify a sample of OBJECT and PLACE figures with BOTH Haiku 4.5
# and Sonnet 4.6, print exact measured cost + full-run projection, write side-by-side md.
# No DB writes. Needs .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
# + ANTHROPIC_API_KEY (the embeddings key OPENAI_API_KEY is NOT needed here).
# RUN run-catalog-load.command FIRST so the Place nodes are loaded.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH

if ! grep -q '^ANTHROPIC_API_KEY=' .env.local 2>/dev/null; then
  echo "⚠️  ANTHROPIC_API_KEY not found in .env.local"
  echo "   Add a line:  ANTHROPIC_API_KEY=sk-ant-..."
  echo "   (Get one at https://console.anthropic.com → API keys.)"
  echo "Press Enter to close…"; read -r _; exit 1
fi

echo "▶ DRY mapping: 20 OBJECT figures × {Haiku 4.5, Sonnet 4.6} …"
python3 worker/catalog-map.py --dry --kind object   --n 20 || { echo "failed"; read -r _; exit 1; }
echo
echo "▶ DRY mapping: 16 PLACE figures × {Haiku 4.5, Sonnet 4.6} …"
python3 worker/catalog-map.py --dry --kind location --n 16 || { echo "failed"; read -r _; exit 1; }

for f in "Element/catalog-map-DRY-object.md" "Element/catalog-map-DRY-location.md"; do
  [ -f "$f" ] && open "$f"
done
echo "Press Enter to close…"; read -r _
