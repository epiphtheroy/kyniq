#!/usr/bin/env bash
# parity-supervise — run the app-parity lane unattended, and stop before it does harm.
# 정본: HANDOFF-앱패리티-공장.md
#
#   nohup bash worker/parity-supervise.sh > factory/logs/parity-supervise.log 2>&1 &
#   touch data/gen/.stop        # halt everything at the next boundary
#
# nohup is not optional: launched as a plain background job this loop dies with the
# shell that started it, which is how an overnight i18n run was lost on 2026-08-05.
#
# The order of business, and why:
#   0. never run while the translation runner is live — they share one subscription
#   1. wait for the database rather than probing it into the ground
#   2. extract the fact blocks (the only step that reads production)
#   3. write 24 as a pilot and AUDIT them; a failed pilot stops the lane
#   4. write the corpus, resuming from the ledger
#   5. reconcile files against source, requeue the gaps, audit again
# Nothing here writes to the database. Loading is a separate, owner-run decision.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"

STOP="data/gen/.stop"
STATE="data/gen/.state"
LOGDIR="factory/logs"
mkdir -p "$LOGDIR" data/gen/out data/gen/src data/gen/requeue

say() { printf '%s  %s\n' "$(date '+%m-%d %H:%M:%S')" "$*"; }
stopped() { [ -f "$STOP" ]; }
mark() { echo "$1" >> "$STATE"; }
did()  { [ -f "$STATE" ] && grep -qxF "$1" "$STATE"; }

trap 'say "signal received — leaving state at $(tail -1 "$STATE" 2>/dev/null)"; exit 0' INT TERM

say "parity-supervise up (pid $$)"

# ── 0. note, but do not defer to, a concurrent translation run ────────────────
# This used to block until the translation lane finished, on the theory that two
# lanes drawing on one subscription would starve each other. In practice the owner
# wants this lane moving, translation corpora arrive at unpredictable hours, and a
# measured six parity workers alongside three translation workers ran clean at 7.3
# items/min with a healthy machine. So coexist, and let concurrency — not a queue —
# be the thing that is tuned. PARITY_CONC exists for exactly that.
if pgrep -f "i18n-translate-run.mjs" > /dev/null 2>&1; then
  say "translation lane also running — coexisting at concurrency ${PARITY_CONC:-6}"
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
  if python3 worker/parity-extract.py --corpus leads 2>&1 | sed 's/^/    /'; then
    mark "extract"; say "extract complete"
  else
    say "extract FAILED — will retry on the next pass"; sleep 900; exec "$0"
  fi
fi

[ -s data/gen/src/leads.json ] || { say "no source corpus; exiting"; exit 1; }

# ── 3. pilot, then judge it ───────────────────────────────────────────────────
if ! did "pilot"; then
  say "pilot: 24 items across the length distribution"
  node scripts/gen-run.mjs --corpus leads --sample 24 --tag pilot --chunk 8 --concurrency 2 2>&1 | sed 's/^/    /'
  say "auditing pilot"
  node scripts/gen-audit.mjs --corpus leads__pilot --samples 6 2>&1 | sed 's/^/    /'
  rc=${PIPESTATUS[0]}
  if [ "$rc" -ne 0 ]; then
    say "PILOT FAILED THE AUDIT — stopping before spending the corpus."
    say "read factory/logs/parity-supervise.log, fix data/gen/prompts/lead-en.md, rm data/gen/.state, restart"
    exit 1
  fi
  mark "pilot"; say "pilot passed"
fi

# ── 4. the corpus ─────────────────────────────────────────────────────────────
if ! did "main"; then
  # Measured: 614 items at 7/min, then four workers hung on unresponsive children for
  # five and a half hours while every indicator said "running". The call timeout inside
  # gen-run.mjs turns that silence into a failure the breaker can see; this watchdog is
  # the second line, in case a future hang happens somewhere the timeout does not reach.
  # Progress is judged by files appearing on disk, because that is the only claim that
  # cannot be made by a process that has stopped working.
  STALL_MIN=25
  for attempt in 1 2 3 4 5 6 7 8; do
    stopped && { say "stop file — exiting"; exit 0; }
    left=$(node scripts/gen-completeness.mjs --corpus leads 2>/dev/null | awk '/MISSING/{print $2}')
    [ "${left:-1}" = "0" ] && { say "corpus complete"; break; }
    say "main run attempt $attempt (${left:-?} remaining)"

    # Per-worker rate is pinned at ~1.4 items/min whatever the chunk size — that is the
    # model's output speed, not this machine's — so throughput tracks concurrency alone.
    # The ceiling is memory: each `claude -p` peaks near 300MB and the box was already
    # 14.7GB into a 15.4GB swap when this was set. Six is double the previous setting and
    # one above a level that ran 88 minutes clean. Raising it further needs RAM freed
    # first, or the workers thrash instead of writing.
    node scripts/gen-run.mjs --corpus leads --chunk 14 --concurrency "${PARITY_CONC:-6}" \
      >> "$LOGDIR/parity-gen.log" 2>&1 &
    genpid=$!

    while kill -0 "$genpid" 2>/dev/null; do
      stopped && { kill "$genpid" 2>/dev/null; say "stop file — exiting"; exit 0; }
      sleep 300
      newest=$(find data/gen/out/leads -name '*.json' -newermt "-${STALL_MIN} minutes" 2>/dev/null | head -1)
      if [ -z "$newest" ]; then
        say "no output for ${STALL_MIN}m — killing a stalled run and resuming"
        pkill -P "$genpid" -f "claude -p" 2>/dev/null
        kill -9 "$genpid" 2>/dev/null
        sleep 5
        break
      fi
    done
    wait "$genpid" 2>/dev/null
    say "run attempt $attempt ended"
    sleep 30
  done
  mark "main"; say "main run finished"
fi

# ── 5. reconcile and repair, until the disk stops disagreeing with the source ──
for pass in 1 2 3; do
  stopped && { say "stop file — exiting"; exit 0; }
  say "reconcile pass $pass"
  node scripts/gen-completeness.mjs --corpus leads --write-requeue 2>&1 | sed 's/^/    /'
  if [ -s data/gen/requeue/leads.json ]; then
    say "requeueing the gap"
    node scripts/gen-run.mjs --corpus leads --requeue --chunk 12 \
      --concurrency "${PARITY_CONC:-6}" >> "$LOGDIR/parity-gen.log" 2>&1
    rm -f data/gen/requeue/leads.json
  else
    say "no gap remains"; break
  fi
done

say "audit of the whole corpus"
node scripts/gen-audit.mjs --corpus leads --samples 10 --write-requeue 2>&1 | sed 's/^/    /'

if [ -s data/gen/requeue/leads.qa.json ]; then
  say "rewriting what the audit flagged"
  node scripts/gen-run.mjs --corpus leads --requeue --chunk 10 --concurrency 3 2>&1 | sed 's/^/    /'
  rm -f data/gen/requeue/leads.qa.json
  node scripts/gen-audit.mjs --corpus leads --samples 6 2>&1 | sed 's/^/    /'
fi

say "parity lane complete. Nothing was written to the database."

# ── 6. hand the remaining subscription time to the translation backlog ────────
# The Korean invitation corpus is short by the items a pre-fix run overwrote. That
# work is real, it needs no database, and by now the parity lane is done competing
# for the same quota — so it runs last rather than not at all.
if ! stopped && [ -f scripts/i18n-completeness.mjs ]; then
  say "reconciling the Korean invitation corpus"
  node scripts/i18n-completeness.mjs --write-requeue 2>&1 | sed 's/^/    /'
  if [ -s data/i18n/requeue/repolish_invitation.json ]; then
    say "requeueing the Korean gap (fixed runner: RUN_ID filenames, no overwrite)"
    node scripts/i18n-translate-run.mjs --corpus repolish_invitation --requeue \
      --chunk 8 --concurrency 3 2>&1 | sed 's/^/    /'
    node scripts/i18n-completeness.mjs 2>&1 | sed 's/^/    /'
  else
    say "Korean corpus complete on disk"
  fi
fi

say "all lanes done."
say "next, by hand: apply 0136, then node scripts/load-film-leads.mjs --gentle"
