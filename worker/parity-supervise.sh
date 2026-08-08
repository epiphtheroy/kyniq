#!/usr/bin/env bash
# parity-supervise — run the app-parity lane unattended, and stop before it does harm.
# 정본: HANDOFF-앱패리티-공장.md · 런북: docs/RUNBOOK-app-parity.md
#
#   PARITY_CONC=6 nohup bash worker/parity-supervise.sh > factory/logs/parity-supervise.log 2>&1 &
#   touch data/gen/.stop        # halt everything at the next boundary
#
# nohup is not optional: launched as a plain background job this loop dies with the
# shell that started it, which is how an overnight i18n run was lost on 2026-08-05.
#
# The order of business, and why:
#   0. note a concurrent translation run, but do not defer to it
#   1. wait for the database rather than probing it into the ground
#   2. extract the fact blocks (the only step that reads production)
#   3. write 24 as a pilot and AUDIT them; a failed pilot stops the lane
#   4. write the film corpus, resuming from the ledger
#   5. reconcile files against source, requeue the gaps, audit, rewrite what it flags
#   6. do the same for the director Life panels
#   7. give whatever time is left to the Korean translation backlog
# Nothing here writes to the database. Loading is a separate, owner-run decision.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"

STOP="data/gen/.stop"
STATE="data/gen/.state"
LOGDIR="factory/logs"
CONC="${PARITY_CONC:-6}"
STALL_MIN=25
mkdir -p "$LOGDIR" data/gen/out data/gen/src data/gen/requeue

say() { printf '%s  %s\n' "$(date '+%m-%d %H:%M:%S')" "$*"; }
stopped() { [ -f "$STOP" ]; }
mark() { echo "$1" >> "$STATE"; }
did()  { [ -f "$STATE" ] && grep -qxF "$1" "$STATE"; }

trap 'say "signal received — leaving state at $(tail -1 "$STATE" 2>/dev/null)"; exit 0' INT TERM

say "parity-supervise up (pid $$, concurrency $CONC)"

# ── 0. note, but do not defer to, a concurrent translation run ────────────────
# This used to block until the translation lane finished, on the theory that two
# lanes drawing on one subscription would starve each other. In practice the owner
# wants this lane moving, translation corpora arrive at unpredictable hours, and a
# measured six parity workers alongside three translation workers ran clean at 7.3
# items/min. So coexist, and let concurrency — not a queue — be what is tuned.
if pgrep -f "i18n-translate-run.mjs" > /dev/null 2>&1; then
  say "translation lane also running — coexisting"
else
  say "translation lane idle"
fi

# ── 1. wait for the database ──────────────────────────────────────────────────
if ! did "extract"; then
  ok=0
  while [ "$ok" -lt 2 ]; do
    stopped && { say "stop file — exiting"; exit 0; }
    if python3 worker/db-health.py --verbose 2>&1 | sed 's/^/    db: /'; then
      ok=$((ok + 1)); say "database healthy ($ok/2)"; sleep 60
    else
      ok=0; say "database not ready; sleeping 10m"; sleep 600
    fi
  done

  # ── 2. extract ──────────────────────────────────────────────────────────────
  say "extracting lead fact blocks"
  if python3 worker/parity-extract.py --corpus leads >> "$LOGDIR/parity-gen.log" 2>&1; then
    mark "extract"; say "extract complete"
  else
    say "extract FAILED — retrying in 15m"; sleep 900; exec "$0"
  fi
fi

[ -s data/gen/src/leads.json ] || { say "no source corpus; exiting"; exit 1; }

# ── 3. pilot, then judge it ───────────────────────────────────────────────────
if ! did "pilot"; then
  say "pilot: 24 items across the length distribution"
  node scripts/gen-run.mjs --corpus leads --sample 24 --tag pilot --chunk 8 --concurrency 2 \
    >> "$LOGDIR/parity-gen.log" 2>&1
  say "auditing pilot"
  if node scripts/gen-audit.mjs --corpus leads__pilot --samples 6 >> "$LOGDIR/parity-gen.log" 2>&1; then
    mark "pilot"; say "pilot passed"
  else
    say "PILOT FAILED THE AUDIT — stopping before spending the corpus."
    say "read $LOGDIR/parity-gen.log, fix data/gen/prompts/lead-en.md, rm data/gen/.state, restart"
    exit 1
  fi
fi

# ── the engine ────────────────────────────────────────────────────────────────
# One writing pass over one corpus, supervised. Two independent failure modes are
# covered here because they present identically as "still running":
#   · a `claude -p` child that stops answering (four of them once sat for five and a
#     half hours on nine seconds of CPU) — the call timeout inside gen-run.mjs
#     converts that silence into a failure the circuit breaker can act on;
#   · anything the timeout does not reach — caught here, by asking whether files are
#     appearing on disk, which is the one claim a stopped process cannot make.
# The run must be older than the stall window before that question is fair: judging a
# fresh run by "was there output in the last 25 minutes" is automatically false after
# any pause, and on 2026-08-06 that killed three attempts in eleven minutes.
run_corpus() {          # $1 corpus  $2 chunk
  local corpus="$1" chunk="$2" left genpid runstart alive newest
  for attempt in 1 2 3 4 5 6 7 8; do
    stopped && { say "stop file — exiting"; exit 0; }
    left=$(node scripts/gen-completeness.mjs --corpus "$corpus" 2>/dev/null | awk '/MISSING/{print $2}')
    [ "${left:-1}" = "0" ] && { say "$corpus complete"; return 0; }
    say "$corpus attempt $attempt (${left:-?} remaining)"

    node scripts/gen-run.mjs --corpus "$corpus" --chunk "$chunk" --concurrency "$CONC" \
      >> "$LOGDIR/parity-gen.log" 2>&1 &
    genpid=$!
    runstart=$(date +%s)

    while kill -0 "$genpid" 2>/dev/null; do
      stopped && { kill "$genpid" 2>/dev/null; say "stop file — exiting"; exit 0; }
      sleep 300
      alive=$(( $(date +%s) - runstart ))
      [ "$alive" -lt $((STALL_MIN * 60)) ] && continue
      newest=$(find "data/gen/out/$corpus" -name '*.json' -newermt "-${STALL_MIN} minutes" 2>/dev/null | head -1)
      if [ -z "$newest" ]; then
        say "$corpus: no output for ${STALL_MIN}m — killing a stalled run and resuming"
        pkill -P "$genpid" -f "claude -p" 2>/dev/null
        kill -9 "$genpid" 2>/dev/null
        sleep 5
        break
      fi
    done
    wait "$genpid" 2>/dev/null
    say "$corpus attempt $attempt ended"
    sleep 30
  done
}

# Close the gap between what the source asks for and what is actually on disk, then
# let the corpus-level audit find what only shows up at scale — a phrase repeating,
# a column of identical openings — and rewrite those.
reconcile() {           # $1 corpus  $2 chunk
  local corpus="$1" chunk="$2" pass
  for pass in 1 2 3; do
    stopped && { say "stop file — exiting"; exit 0; }
    say "$corpus reconcile pass $pass"
    node scripts/gen-completeness.mjs --corpus "$corpus" --write-requeue >> "$LOGDIR/parity-gen.log" 2>&1
    if [ -s "data/gen/requeue/$corpus.json" ]; then
      node scripts/gen-run.mjs --corpus "$corpus" --requeue --chunk "$chunk" \
        --concurrency "$CONC" >> "$LOGDIR/parity-gen.log" 2>&1
      rm -f "data/gen/requeue/$corpus.json"
    else
      say "$corpus: no gap remains"; break
    fi
  done

  say "$corpus: auditing the whole corpus"
  node scripts/gen-audit.mjs --corpus "$corpus" --samples 10 --write-requeue \
    >> "$LOGDIR/parity-gen.log" 2>&1
  if [ -s "data/gen/requeue/$corpus.qa.json" ]; then
    say "$corpus: rewriting what the audit flagged"
    node scripts/gen-run.mjs --corpus "$corpus" --requeue --chunk "$chunk" \
      --concurrency "$CONC" >> "$LOGDIR/parity-gen.log" 2>&1
    rm -f "data/gen/requeue/$corpus.qa.json"
    node scripts/gen-audit.mjs --corpus "$corpus" --samples 6 >> "$LOGDIR/parity-gen.log" 2>&1
  fi
}

# ── 4~5. the film corpus ──────────────────────────────────────────────────────
if ! did "main"; then
  run_corpus leads 14
  mark "main"; say "film corpus finished"
fi
if ! did "leads-reconciled"; then
  reconcile leads 12
  mark "leads-reconciled"; say "film corpus reconciled"
fi

# ── 6. the director Life panels ───────────────────────────────────────────────
# Small chunks here: every fact needs a source URL the writer actually opened, so a
# batch is research, not transcription, and a large one just means more to redo when
# one item fails. This is also the only corpus that gets web tools, which costs the
# cached-prefix saving — worth it for the one layer we refuse to write from memory.
if ! did "dfacts" && [ -s data/gen/src/dfacts.json ]; then
  say "director Life panels"
  run_corpus dfacts 2
  reconcile dfacts 2
  mark "dfacts"; say "director corpus finished"
fi

say "parity lane complete. Nothing was written to the database."

# ── 7. hand whatever is left to the translation backlog ───────────────────────
if ! stopped && [ -f scripts/i18n-completeness.mjs ]; then
  say "reconciling the Korean invitation corpus"
  node scripts/i18n-completeness.mjs --write-requeue >> "$LOGDIR/parity-gen.log" 2>&1
  if [ -s data/i18n/requeue/repolish_invitation.json ]; then
    say "requeueing the Korean gap"
    node scripts/i18n-translate-run.mjs --corpus repolish_invitation --requeue \
      --chunk 8 --concurrency 3 >> "$LOGDIR/parity-gen.log" 2>&1
    node scripts/i18n-completeness.mjs >> "$LOGDIR/parity-gen.log" 2>&1
  else
    say "Korean corpus complete on disk"
  fi
fi

say "all lanes done."
say "next, by hand: apply 0136, then node scripts/load-film-leads.mjs --gentle"
