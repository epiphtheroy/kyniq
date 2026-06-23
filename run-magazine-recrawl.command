#!/usr/bin/env bash
# ============================================================
# Metatake — Magazine RE-CRAWL (clean snippets).
#   Clears the stored critic snippets and re-fetches them with the new cleaner that
#   strips RSS boilerplate (repeated article title + "By Author" byline), so each
#   stored snippet begins with real prose. Outlets stay as already activated.
#   (Needed because the crawler skips already-stored URLs — a reset re-stores them clean.)
#   Reads keys from .env.local. Runs: worker/magazine-ingest.py --reset
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

for p in "/opt/homebrew/bin" "/usr/local/bin" "/usr/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
export PATH
PY="$(command -v python3 || true)"
[ -z "$PY" ] && { echo "✗ python3 not found."; read -r _; exit 1; }

echo "▶ Clearing + re-crawling active outlets with cleaned snippets…"
"$PY" worker/magazine-ingest.py --reset
echo
echo "✅ Done. Critic snippets re-stored without byline/title boilerplate."
echo "Press Enter to close..."; read -r _
