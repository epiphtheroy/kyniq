#!/usr/bin/env bash
# parity-resume-at — hold the app-parity lane until a wall-clock time, then start it.
#
#   nohup bash worker/parity-resume-at.sh "23:10" 6 > factory/logs/parity-resume.log 2>&1 &
#
# Detached on purpose: the pause is the owner's, not a session's, so the resume must
# outlive whatever shell scheduled it. Cancel by killing this process, or by leaving
# data/gen/.stop in place — the flag is cleared only at the moment of resuming, so a
# stop written after this was scheduled still wins if you re-create it afterwards.
#
# Concurrency is the second argument, not an inherited variable, so that `ps` shows
# exactly what a pending resume will do. A schedule you cannot read back is a schedule
# you have to trust, and this one sits unattended for hours.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"

AT="${1:-23:10}"
CONC="${2:-${PARITY_CONC:-6}}"
say() { printf '%s  %s\n' "$(date '+%m-%d %H:%M:%S')" "$*"; }

secs=$(python3 - "$AT" <<'PY'
import sys, datetime
hh, mm = (sys.argv[1].split(":") + ["0"])[:2]
now = datetime.datetime.now()
t = now.replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
if t <= now:
    t += datetime.timedelta(days=1)      # a time already past means tomorrow
print(int((t - now).total_seconds()), t.strftime("%Y-%m-%d %H:%M"))
PY
)
delay=$(echo "$secs" | awk '{print $1}')
when=$(echo "$secs" | cut -d' ' -f2-)

say "holding until $when (${delay}s) — lane paused, nothing running"
sleep "$delay"

say "resuming at concurrency $CONC"
rm -f data/gen/.stop
PARITY_CONC="$CONC" nohup bash worker/parity-supervise.sh \
  >> factory/logs/parity-supervise.log 2>&1 &
say "supervisor relaunched (pid $!)"
