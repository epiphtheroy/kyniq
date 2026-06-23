#!/usr/bin/env bash
# ============================================================
# Metatake — RAG (v2) surface. Self-contained in app/rag/, shipped on an
# ISOLATED route so the live /ask (v1) and the rest of the site are untouched.
#
#   What this commits (and ONLY this):
#     • app/rag/**            — the whole RAG feature in one folder:
#         page.tsx, layout.tsx, rag.css (RAG-only styles — globals.css NOT touched),
#         _components/ (AskReadings, FurtherReading), _lib/ (queryUnderstanding,
#         rerank, diversify, prompt, academic), README.md
#     • app/api/rag/route.ts  — the API endpoint (Next.js requires API routes
#                               under app/api/, so it can't sit inside app/rag/)
#     • components/MetatakeNav.tsx — ONE added line: the "RAG" nav link
#
#   NOT touched: app/api/ask/route.ts (v1), app/ask/page.tsx, app/globals.css,
#   worker/, data/, and the 170+ other working-tree changes. Surgical add only.
#
#   *** ENV (Vercel → kyniq-5eox → Settings → Environment Variables) ***
#   REQUIRED: OPENAI_API_KEY (already set for v1 /ask — /api/rag reuses it).
#   OPTIONAL: ASK_MODEL (default gpt-4o-mini) · RERANK_PROVIDER (default fallback;
#             set cohere|voyage + COHERE_API_KEY/VOYAGE_API_KEY) ·
#             ACADEMIC_FURTHER_READING=1 + ACADEMIC_MAILTO=you@domain.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

# --- clear an ORPHANED git lock (safe: judged by whether git is actually running,
#     not by age — a crashed git can leave a brand-new lock with nobody holding it) ---
if [ -f .git/index.lock ]; then
  # let any genuinely-running git finish (up to ~15s)
  for i in 1 2 3 4 5; do
    pgrep -x git >/dev/null 2>&1 || break
    echo "⏳ A git process is running — waiting for it to finish ($i/5)…"; sleep 3
  done
  if pgrep -x git >/dev/null 2>&1; then
    echo "✗ A git process is STILL running (another tool may be committing)."
    echo "  Nothing was changed. Wait ~30s and just double-click this file again."
    echo "Press Enter to close..."; read -r _; exit 1
  fi
  echo "⚠ No git process is running, but a lock file exists → it's orphaned. Removing it."
  rm -f .git/index.lock
  sleep 1
  if [ -f .git/index.lock ]; then
    echo "✗ The lock reappeared immediately — a process is actively recreating it."
    echo "  Wait ~30s and double-click again."
    echo "Press Enter to close..."; read -r _; exit 1
  fi
fi

# --- make node/npx reachable when launched by double-click (no login shell) ---
for p in "/opt/homebrew/bin" "/usr/local/bin" "$HOME/.volta/bin" "$HOME/.bun/bin" "$HOME/.asdf/shims"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH" ;; esac
done
if [ -d "$HOME/.nvm/versions/node" ]; then
  nvmbin="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$nvmbin" ] && PATH="$nvmbin:$PATH"
fi
export PATH

find .next -name "* [0-9].ts" -delete 2>/dev/null || true

# --- typecheck gate: don't push broken code (skips gracefully if node not found) ---
if command -v npx >/dev/null 2>&1; then
  echo "▶ Typechecking (tsconfig.check.json)…"
  if npx tsc -p tsconfig.check.json --noEmit; then
    echo "✓ Typecheck passed."
  else
    echo "✗ Typecheck FAILED — not pushing."
    echo "  (If the errors are in files you didn't touch — app/page.tsx, worker/* —"
    echo "   they're from concurrent work; stash/resolve them, then retry.)"
    echo "Press Enter to close..."; read -r _; exit 1
  fi
else
  echo "⚠ Node/npx not on PATH — skipping local typecheck (Vercel build will gate)."
fi

# --- commit ONLY the RAG feature (surgical; the rest of the tree is left alone) ---
git add \
  app/rag \
  app/api/rag/route.ts \
  components/MetatakeNav.tsx

if git diff --cached --quiet; then
  echo "ℹ Nothing staged (already committed?). Skipping commit."
else
  git commit -m "RAG (v2) surface, self-contained in app/rag/: /rag page + /api/rag (query-understanding + rerank + dynamic diversify + academic rail) + RAG nav link"
fi

echo "▶ Pushing to origin/main…"
git push origin main

echo
echo "✅ Pushed. Vercel (kyniq-5eox) auto-builds (~1–2 min)."
echo "   Open:  https://metatake.net/rag"
echo "   Verify: ask a question → [n] citations, Answer/Readings toggle,"
echo "           diagnostic strip shows intent · lang · reranker · model."
echo "   Multilingual: try '거울은 영화에서 무엇을 의미하는가?' (strip lang should be ko)."
echo "   Note: import/embedding still in progress, so retrieval may be partial until W6."
echo "Press Enter to close..."; read -r _
