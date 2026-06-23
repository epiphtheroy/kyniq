#!/usr/bin/env bash
# ============================================================
# Metatake — Magazine ingest: allow-listed critic outlets → SHORT, fair-use
# snippets + embeddings, so /ask answers can weave in attributed critic quotes.
#   Runs three steps in order:
#     1) --seed        upsert outlets from data/sources/magazine-allowlist.csv (all inactive)
#     2) --enable rss  activate only RSS-incremental + robots-allowing outlets
#     3) (crawl)       fetch each active outlet's RSS, store a ~60-word excerpt + 1536-d embedding
#   Fair-use safeguards live in the worker: short excerpts only, attribution + link kept,
#   per-outlet active gate. Quote length is capped again at answer time.
#   Reads keys from .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + OPENAI_API_KEY).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

for p in "/opt/homebrew/bin" "/usr/local/bin" "/usr/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
export PATH
PY="$(command -v python3 || true)"
[ -z "$PY" ] && { echo "✗ python3 not found. Install Python 3, then re-run."; echo "Press Enter to close..."; read -r _; exit 1; }

echo "▶ 1/3  Seeding outlets from the allow-list (all inactive)…"
"$PY" worker/magazine-ingest.py --seed || { echo "✗ seed failed"; read -r _; exit 1; }
echo
echo "▶ 2/3  Enabling RSS-incremental + robots-allowing outlets…"
"$PY" worker/magazine-ingest.py --enable rss || { echo "✗ enable failed"; read -r _; exit 1; }
echo
echo "▶ 3/3  Crawling active outlets → storing short snippets + embeddings…"
"$PY" worker/magazine-ingest.py
echo
echo "✅ Done. Critic snippets are stored. Once /ask is on RAG (deploy-rag-launch.command),"
echo "   short attributed quotes will appear in answers where relevant."
echo "Press Enter to close..."; read -r _
