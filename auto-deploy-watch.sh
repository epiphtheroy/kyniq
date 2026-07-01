#!/usr/bin/env bash
# Metatake auto-deploy watcher.
# Watches app/ components/ lib/ for changes; once edits go quiet for DEBOUNCE seconds,
# stages just those paths, commits, and pushes to main (Vercel auto-builds).
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
      [ -f "$REPO/.git/index.lock" ] && rm -f "$REPO/.git/index.lock"
      git add -- app components lib >> "$LOG" 2>&1
      if git commit -m "auto-deploy $ts" >> "$LOG" 2>&1; then
        if git push origin main >> "$LOG" 2>&1; then
          echo "[$ts] pushed OK" >> "$LOG"
        else
          echo "[$ts] PUSH FAILED" >> "$LOG"
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
