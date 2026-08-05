#!/bin/zsh
# i18n-run-all — translate every remaining Korean corpus through the subscription CLI.
# Resumable: each corpus skips keys already in data/i18n/ko-run-ledger.jsonl.
# Kill switch: touch data/i18n/.stop
set -u
export PATH="$HOME/.local/node/bin:$PATH"
cd /Users/jerryje/Developer/MetaTake

run() {  # corpus chunk concurrency
  echo "\n================ $1 (chunk $2, conc $3) $(date '+%H:%M:%S') ================"
  node scripts/i18n-translate-run.mjs --corpus "$1" --chunk "$2" --concurrency "$3" 2>&1 | tail -40
}

run repolish_laconic     60 4
run repolish_trope_title 100 4
run dfacts_items         40 4
run dfacts_intro         30 4
run dfacts_meaning       30 4
run portrait              8 4
run repolish_invitation   8 4

echo "\n================ ALL CORPORA DONE $(date '+%H:%M:%S') ================"
