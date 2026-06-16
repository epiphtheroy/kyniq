#!/usr/bin/env bash
# ============================================================
# Metatake — deploy: disclosure / intro copy edits (About + Guidelines).
# (Also commits the worker fix for trope-tag's integer-index ids — local tool,
#  doesn't affect the site build.)
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"
git add -A
git commit -m "Disclosure copy: factual-vs-interpretation, audit-loop framing, accuracy

- About 'How our readings are written': reframe immediate-publish as an intentional
  audit-and-revision loop; distinguish factual errors (we fix) from interpretations
  (stay open); credit editor Wonwoo Yoon; soften the 'scholarship' claim to
  'film-critical traditions' (citations are AI-provided and not yet verified);
  'posters and stills from TMDB' (we don't embed clips).
- Guidelines: 'no wrong readings' → interpretations aren't right/wrong, but factual
  errors are worth flagging.
- worker: trope-tag identifies figures by integer index (avoids UUID-mangling FK errors)."
git push origin main
echo
echo "✅ Pushed. Vercel auto-deploys (~1-2 min)."
echo "Press Enter to close..."; read -r _
