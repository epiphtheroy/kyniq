#!/usr/bin/env bash
# Catalog v0 loader — parse Element/*.xlsx → embed (text-embedding-3-small) → load taxonomy_nodes.
# Needs .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + OPENAI_API_KEY.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin"; do [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
echo "▶ ensuring pandas + openpyxl …"
python3 -m pip install --quiet --break-system-packages pandas openpyxl 2>/dev/null || python3 -m pip install --quiet pandas openpyxl 2>/dev/null || true
echo "▶ DRY (parse only) …"
python3 worker/catalog-load.py --dry || { echo "DRY failed"; read -r _; exit 1; }
echo
echo "Review the counts above."
echo "Press Enter to APPLY (wipes taxonomy_nodes, embeds ~2,900 nodes incl. Places via OpenAI, loads), or Ctrl-C to abort."
read -r _
python3 worker/catalog-load.py --apply
echo "Press Enter to close…"; read -r _
