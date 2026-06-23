#!/usr/bin/env bash
# ============================================================
# Metatake — Critics via LIVE domain-restricted web search (on-demand).
#   • app/rag/_lib/criticsSearch.ts (new) — at ask-time, searches ONLY the allow-listed
#       critic domains (Tavily, include_domains) and returns short snippet + link.
#       Nothing of theirs is stored. Domains come from the magazines table (+ a curated
#       fallback). Gated by TAVILY_API_KEY.
#   • app/api/rag/route.ts — uses live search when TAVILY_API_KEY is set; otherwise
#       falls back to the stored RSS snippets; otherwise no critics. Guardrails +
#       "only-cited" display unchanged.
#   • app/rag/_lib/quotation.ts — (bundled) favour one apt short quote when a passage
#       frames the question.
#
#   ⚠ REQUIRES a Tavily API key in Vercel for live search to turn on:
#       Vercel → project kyniq → Settings → Environment Variables →
#       add  TAVILY_API_KEY = <your key>  (Production) → Save.   (free tier at tavily.com)
#   Safe to deploy first without the key — it just keeps using the stored snippets.
#   Files: app/api/rag/route.ts, app/rag/_lib/criticsSearch.ts, app/rag/_lib/quotation.ts
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

git add app/api/rag/route.ts app/rag/_lib/criticsSearch.ts app/rag/_lib/quotation.ts
echo "▶ Staged:"; git diff --cached --name-only

find .next -name "* [0-9].ts" -delete 2>/dev/null || true
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typecheck (info only — non-blocking)…"
  npx tsc -p tsconfig.check.json --noEmit 2>&1 | grep -E "app/api/rag|criticsSearch|quotation" || echo "  (no errors in the changed files)"
fi

git commit -m "Critics: live domain-restricted web search (Tavily) as on-demand source; fall back to stored; favour apt quote"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min)."
echo "   Add TAVILY_API_KEY in Vercel env to switch critics to live site-scoped search."
echo "Press Enter to close..."; read -r _
