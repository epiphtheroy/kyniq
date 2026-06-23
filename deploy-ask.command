#!/usr/bin/env bash
# ============================================================
# Metatake — "Ask Metatake" v1 (grounded Q&A over the 18,004 readings).
#   • /ask            : new grounded ask page (question box, example chips,
#                       answer with [n] citations linking to real readings,
#                       "threads to pull" + sources).
#   • /ask/new        : the old community "Ask a question" form, moved here.
#   • /api/ask        : embed(query) -> ask_retrieve RPC (pgvector + FTS, RRF)
#                       -> grounded LLM (OpenAI) -> {answer, citations, kin}.
#   • nav             : "Ask" added to the main nav; Masthead community links
#                       repointed to /ask/new.
#   (DB: ask_retrieve RPC + rationale FTS index are already live.)
#
#   *** REQUIRED: set OPENAI_API_KEY in Vercel ***
#   /api/ask calls OpenAI for BOTH the query embedding and the answer.
#   Embeddings were generated locally, so Vercel may not have the key yet.
#   In Vercel → your project → Settings → Environment Variables, add
#   OPENAI_API_KEY (Production) if it isn't there, then redeploy.
#   (Optional: ASK_MODEL, defaults to gpt-4o-mini.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add app/ask/page.tsx app/ask/new/page.tsx app/api/ask/route.ts \
        components/Masthead.tsx components/MetatakeNav.tsx app/globals.css
git commit -m "Ask Metatake v1: grounded Q&A over readings (/ask) + move community form to /ask/new + /api/ask route"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min)."
echo "   ⚠ If /ask says 'not configured', add OPENAI_API_KEY in Vercel env and redeploy."
echo "   Then try /ask with: 'How does cinema portray surveillance?'"
echo "Press Enter to close..."; read -r _
