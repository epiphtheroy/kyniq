#!/bin/zsh
# Metatake — film-extract FULL run (PERSIST). Generates + writes figures(approved) +
# takes(published) for EVERY film that has no figures yet. Idempotent: films that
# already have figures are skipped, so it's safe to re-run / resume.
#
#   ORDER: run-tmdb-fetch-all.command FIRST — it fills each new film's overview/cast,
#   which film-extract uses to ground the figures (and the film pages need the media).
#
# Tip: process in batches by adding  --limit 50  (re-run to continue). Model: Opus 4.8.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=film-extract.log; : > "$LOG"
echo "▶ film-extract FULL (PERSIST) — all figure-less films ($(date))" | tee -a "$LOG"
$PY -u film-extract.py --persist 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Persist done. Next: run-mt-embed.command → mt-consolidate → mt-author → mt-rank → mt-recommend → trope-* → theory-*." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
