#!/bin/zsh
# ============================================================
# FilmCurio / Metatake — figure enrichment pilot (figure-page-design.md §8).
# Gives figures >=3 register-diverse takes converging on shared meta takes.
#
# DEFAULT = DRY RUN: writes worker/figure-enrich.bundle.json, NO DB writes.
# Inspect that bundle FIRST (register diversity, evidence-first, convergence).
# To actually write to the DB: apply migration 0014 first, then run with --persist.
#
# Edit the --film list below for your pilot films (use their slugs).
# Requires GEMINI_API_KEY + Supabase service key in .env.local.
# ============================================================
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=figure-enrich.log; : > "$LOG"

echo "▶ Figure enrichment CANARY — PERSIST 2 films (Forrest Gump + Power of the Dog) ($(date))" | tee -a "$LOG"
echo "  ⚠ THIS WRITES TO THE DB. Rollback boundary = the timestamp above." | tee -a "$LOG"
# Canary: persist exactly 2 films, all figures, single Gemini 3.1 Pro call each.
# -u = live progress. need_enrich gate makes re-runs safe (skips already-enriched figures).
$PY -u figure-enrich.py --film forrest-gump-1994 --film the-power-of-the-dog-2021 --persist 2>&1 | tee -a "$LOG"

echo "" | tee -a "$LOG"
echo "✅ Done. Look at the per-film lines above:" | tee -a "$LOG"
echo "   • 'PERSIST done: N takes' = N takes written to the DB" | tee -a "$LOG"
echo "   • any '⚠ slug: X/Y figures matched' = re-run this command to fill the rest (idempotent)" | tee -a "$LOG"
echo "   • already-enriched figures are skipped automatically (need_enrich gate)" | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
