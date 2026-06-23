#!/bin/zsh
# Metatake — REDO the 15 canary films cleanly with the kind-bug fix.
# --reset deletes ONLY these named films' source='ai' figures (takes cascade) then
# re-extracts a full, complete set. Seed figures (source='seed') are never touched.
# After this, run run-film-extract.command for the remaining ~388 films.
cd "$(dirname "$0")"
export PATH="$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PY=/usr/bin/python3; command -v $PY >/dev/null 2>&1 || PY=python3
LOG=film-extract-redo.log; : > "$LOG"
echo "▶ film-extract REDO — 15 canary films (--reset) ($(date))" | tee -a "$LOG"
$PY -u film-extract.py --persist --reset \
  --film apocalypse-now-1979 --film suspiria-1977 --film rosemary-s-baby-1968 \
  --film one-battle-after-another-2025 --film persona-1966 --film psycho-1960 \
  --film stalker-1979 --film 2001-a-space-odyssey-1968 --film talk-to-me-2023 \
  --film petite-maman-2021 --film sentimental-value-2025 --film annie-hall-1977 \
  --film flow-2024 --film the-evil-dead-1981 --film return-to-seoul-2022 2>&1 | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "✅ Redo done — each should now show ~7-8 figures with NO 'figure insert 400' errors." | tee -a "$LOG"
echo "   Tell me; I'll verify, then you run run-film-extract.command for the rest." | tee -a "$LOG"
echo "Press Enter to close..."; read -r _
