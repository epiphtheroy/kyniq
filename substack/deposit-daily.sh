#!/bin/bash
# "Between Film and the World" — daily deposit job.
#
# Writes tomorrow's draft to substack/drafts/YYYY-MM-DD.md. It NEVER publishes;
# publishing stays a separate, deliberate step (worker/blog-ingest.py --persist).
#
# History: this ran as a scheduled task inside the Cowork app against
# ~/Documents/MetaTake. The repo moved to ~/Developer/MetaTake on 2026-07-29 and
# the job stopped — the last draft it deposited was 2026-07-29.md. Rebuilt
# 2026-08-03 as a local headless `claude -p` run so the tokens come out of the
# flat-rate Claude Code subscription instead of the pay-per-use API key.
#
# Schedule: ~/Library/LaunchAgents/net.metatake.substack-deposit.plist
#   load:   launchctl load   ~/Library/LaunchAgents/net.metatake.substack-deposit.plist
#   unload: launchctl unload ~/Library/LaunchAgents/net.metatake.substack-deposit.plist
# Run by hand:  ./substack/deposit-daily.sh
# Pause:        touch substack/HOLD     (delete to resume)
set -u

REPO="/Users/jerryje/Developer/MetaTake"
LOG="$REPO/substack/deposit.log"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

cd "$REPO" || exit 1

if [ -f "$REPO/substack/HOLD" ]; then
  echo "[$(date -u +%FT%TZ)] HOLD present — skipping" >> "$LOG"; exit 0
fi

# Weekdays only (the newsletter is a weekday briefing). 1=Mon … 7=Sun.
DOW=$(date +%u)
if [ "$DOW" -gt 5 ]; then
  echo "[$(date -u +%FT%TZ)] weekend — skipping" >> "$LOG"; exit 0
fi

# The issue is a US-morning briefing covering the prior ~24h, so the issue date
# is today's date in America/New_York at the time this runs (17:00 KST = 04:00 ET).
ISSUE=$(TZ=America/New_York date +%F)

if [ -f "$REPO/substack/drafts/$ISSUE.md" ]; then
  echo "[$(date -u +%FT%TZ)] $ISSUE.md already deposited — skipping" >> "$LOG"; exit 0
fi

echo "===== [$(date -u +%FT%TZ)] deposit start · issue $ISSUE =====" >> "$LOG"

read -r -d '' PROMPT <<EOF
You are the deposit job for the Metatake newsletter "Between Film and the World".

Read substack/README.md first and follow it exactly — it is the canonical
editorial recipe (the 4 levers, the daily steps, the front-matter contract, the
link shapes). Do not invent rules that are not in it.

Today's issue date (ET) is $ISSUE.

Your task, end to end:
1. Read substack/README.md.
2. Read the last 3 files in substack/drafts/ so you do not repeat films or figures.
3. Research today's major news with web search, across politics, world, business,
   tech, culture and sport.
4. Verify EVERY film / reading / trope against the live database before you link
   it. This is the hard rule in the README: a 404 kills the premise. Query
   Supabase over its REST API with curl, reading the credentials out of
   .env.local (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY). Send the
   header 'User-Agent: MetatakeHourly/1.0' — the new-format secret keys reject
   browser-like user agents. Never print a key. Examples:
     films:    /rest/v1/films?select=slug,title,year&title=ilike.<Title>*
     readings: /rest/v1/meta_takes?select=slug,title&status=eq.published&kind=eq.reading&title=ilike.*<concept>*
     tropes:   /rest/v1/meta_takes?select=slug,title&status=eq.published&kind=eq.figure_type&title=ilike.*<concept>*
   Use the exact slug the database returns. If a film is absent, swap it for one
   that exists or drop the item. Never link an unpublished candidate reading.
5. Write substack/drafts/$ISSUE.md — the front-matter contract from the README
   plus the body, with status: pending_review.
6. Append one line to substack/ledger.md in the existing format.

Do NOT publish, do NOT run worker/blog-ingest.py, and do NOT touch any file
outside substack/drafts/ and substack/ledger.md. Finish by printing one line:
DEPOSITED <path> · <n> items
EOF

claude -p "$PROMPT" \
  --model opus \
  --allowed-tools Read Write Edit Glob Grep WebSearch WebFetch Bash \
  --disallowed-tools Task \
  --output-format text \
  >> "$LOG" 2>&1
rc=$?

if [ $rc -eq 0 ] && [ -f "$REPO/substack/drafts/$ISSUE.md" ]; then
  echo "[$(date -u +%FT%TZ)] ✓ deposited $ISSUE.md" >> "$LOG"
else
  echo "[$(date -u +%FT%TZ)] ✗ deposit failed (rc=$rc, no draft written)" >> "$LOG"
fi
echo "===== [$(date -u +%FT%TZ)] deposit end =====" >> "$LOG"
