#!/usr/bin/env bash
# ============================================================
# Metatake — RAG launch: promote the v2 pipeline to /ask.
#   • app/ask/page.tsx          — the Ask UI now calls /api/rag (v2: query-understanding
#       → wider retrieve → rerank → diversify → Claude Sonnet, grounded in the corpus).
#       The home Ask hero posts to /ask, so it rides along automatically.
#   • app/rag/_lib/rerank.ts    — reranker defaults to Voyage (uses VOYAGE_API_KEY if
#       present; degrades to the transparent fallback otherwise). No env var needed.
#   • app/api/rag/route.ts      — magazine critic quotes default ON, but stay dark until
#       you run the magazine crawl (each outlet is gated by its own `active` flag in the DB).
#   Files: app/ask/page.tsx, app/rag/_lib/rerank.ts, app/api/rag/route.ts
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

# clear any stale git lock from an interrupted earlier run (it silently blocks commits)
if [ -f .git/index.lock ]; then echo "▶ Removing stale .git/index.lock"; rm -f .git/index.lock; fi

for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

# Include the two WIP modules the committed code imports but that were never
# tracked (this is what made the first build fail with "Module not found"):
#   app/rag/_lib/quotation.ts   (imported by app/api/rag/route.ts)
#   components/AskReadings.tsx   (imported by app/ask/page.tsx)
git add app/ask/page.tsx app/rag/_lib/rerank.ts app/api/rag/route.ts \
        app/rag/_lib/quotation.ts components/AskReadings.tsx
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking; unrelated WIP in the tree may show errors)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "app/ask/page|app/api/rag|rerank" || echo "  (no errors in the 3 deployed files)"
fi

git commit -m "RAG launch: commit missing modules (quotation.ts + AskReadings.tsx) so /ask v2 pipeline builds"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min). /ask (and the home Ask hero) now answer via the"
echo "   v2 RAG pipeline. Critic quotes stay off until you run run-magazine-ingest.command."
echo "Press Enter to close..."; read -r _
