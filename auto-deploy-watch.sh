#!/usr/bin/env bash
# Metatake auto-STAGE watcher (P0 pipeline, 2026-07-17).
# Watches app/ components/ lib/ for changes; once edits go quiet for DEBOUNCE seconds,
# stages just those paths, commits, and pushes to the STAGING branch — never main.
# Vercel builds staging into the preview site; production only moves when the
# owner runs release.command (staging → main). Hotfix path: manual push to main.
# Pause anytime by creating a file named ".autodeploy-off" in the project root.
REPO="/Users/jerryje/Documents/MetaTake"
LOG="$REPO/.autodeploy.log"
INTERVAL=5      # poll seconds
DEBOUNCE=20     # seconds of quiet before a push (batches a burst of edits)
cd "$REPO" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.volta/bin:$PATH"
if [ -d "$HOME/.nvm/versions/node" ]; then nb="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null|sort -V|tail -1)"; [ -n "$nb" ] && PATH="$nb:$PATH"; fi

echo "[$(date '+%F %T')] watcher started (interval=${INTERVAL}s debounce=${DEBOUNCE}s)" >> "$LOG"
prev=""; quiet=0
while true; do
  if [ -f "$REPO/.autodeploy-off" ]; then sleep "$INTERVAL"; prev=""; quiet=0; continue; fi
  cur="$(git status --porcelain -- app components lib 2>/dev/null)"
  if [ -n "$cur" ]; then
    if [ "$cur" != "$prev" ]; then quiet=0; else quiet=$((quiet + INTERVAL)); fi
    if [ "$quiet" -ge "$DEBOUNCE" ]; then
      ts="$(date '+%F %T')"
      if [ -f "$REPO/.git/index.lock" ]; then
        # Only clear a lock that's clearly stale — a fresh one belongs to a
        # live git process (another agent/session) and deleting it corrupts it.
        if [ -n "$(find "$REPO/.git/index.lock" -mmin +2 2>/dev/null)" ]; then
          rm -f "$REPO/.git/index.lock"
        else
          sleep "$INTERVAL"; continue
        fi
      fi
      git add -- app components lib >> "$LOG" 2>&1
      if git commit -m "auto-stage $ts" >> "$LOG" 2>&1; then
        if git push origin +HEAD:staging >> "$LOG" 2>&1; then
          echo "[$ts] pushed to staging OK" >> "$LOG"
        else
          echo "[$ts] STAGING PUSH FAILED" >> "$LOG"
        fi
      else
        echo "[$ts] nothing to commit" >> "$LOG"
      fi
      quiet=0; cur=""
    fi
  fi
  prev="$cur"
  sleep "$INTERVAL"
done
