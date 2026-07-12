#!/bin/bash
# ============================================================
# Metatake — restart ALL background watchers after a reboot.
#
# Why this exists: launchd/cron cannot run these — they are TCC-blocked
# from reading ~/Documents ("Operation not permitted"). So every watcher
# is a nohup while-loop that must be (re)started from a Terminal-context
# shell. After a reboot, double-click this once to bring them all back.
#
# Each watcher is guarded by a pgrep "already running?" check, so running
# this repeatedly is safe — it only starts what is not already alive.
# ============================================================
set -uo pipefail
REPO="/Users/jerryje/Documents/MetaTake"
cd "$REPO" || exit 1
echo "▶ Repo: $(pwd)"
echo

# start <label> <relative-script-path> [args...]
start() {
  local label="$1"; local rel="$2"; shift 2
  local path="$REPO/$rel"
  if [ ! -f "$path" ]; then
    echo "⏭  $label — not present ($rel), skipping"
    return
  fi
  # pgrep on the full script path; already alive → leave it.
  if pgrep -f "$rel" >/dev/null 2>&1; then
    echo "✔  $label — already running"
    return
  fi
  nohup "$path" "$@" >/dev/null 2>&1 &
  echo "▶  $label — started (pid $!)"
}

start "auto-deploy"      "auto-deploy-watch.sh"
start "now-playing"      "hourly/now-playing-watch.sh"
start "gsc-daily"        "worker/gsc-daily-watch.sh"
start "film-clips-daily" "worker/film-clips-daily.sh"
start "factory-watch"    "factory-watch.sh"
start "factory-sentinel" "factory-sentinel.sh"

echo
echo "✅ Done. Check with:  pgrep -fl 'watch|daily|sentinel'"
echo "Press Enter to close..."; read -r -n1 _
