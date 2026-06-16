#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: meta-take readability + type weight + Korean fallback.
# Double-click: commit + push to origin/main (Vercel auto-deploy).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git status --short
git add -A
git commit -m "Type polish: weight 400, darker take text, dividers, Korean fallback

- Body weight 350 → 400 across .mt/.fig/.film-info text (per request).
- Meta-take 'All takes': each take row now divided by a hairline (it's a DB of
  many films' takes, not one essay) — scoped to rows with a reading via :has().
- Take rationale colour darkened (#6B6B6B → #3d3d3d) for readability.
- Korean glyphs (incl. Chrome auto-translate) fall back to a real Korean font
  (Apple SD Gothic Neo / Pretendard / Malgun Gothic / Noto Sans KR) at full
  weight, instead of a thin synthesized fallback; html[lang=ko] makes it primary."
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys (~1-2 min)."
echo "Press Enter to close..."; read -r _
