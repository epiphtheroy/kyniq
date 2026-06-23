#!/usr/bin/env bash
# ============================================================
# Metatake — Ask v1.1: smarter answers (retrieval + prompt).
#   Retrieval (rerank-lite + diversity): pull 40 candidates, then keep ~14
#   forcing variety — one take per figure, max 2 per film — so the model sees
#   a broad spread of evidence, not three angles on one scene.
#   Prompt/context: each cited take now carries its cross-film reading; the
#   system prompt gains a literary gold exemplar + structure rules (open with
#   the through-line, compare/tension, cite every claim, end with kin).
#   Response now also returns token/cost meta (for eval).
#   (DB already fixed separately: ivfflat index + tuned ask_retrieve.)
#   Does NOT touch the homepage (app/page.tsx) — that's a separate decision.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add app/api/ask/route.ts worker/ask-eval.py worker/run-ask-eval.command
git commit -m "Ask v1.1: rerank-lite + diversity retrieval, richer reading context, gold-exemplar prompt, cost meta + eval"
git push origin main
echo
echo "✅ Pushed. Vercel rebuilds (~1-2 min)."
echo "   Then measure quality + cost:  worker/run-ask-eval.command"
echo "Press Enter to close..."; read -r _
