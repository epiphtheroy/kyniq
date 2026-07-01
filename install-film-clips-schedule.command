#!/bin/zsh
# Installs a macOS launchd job that runs the clip worker every day at 11:00 (local time).
# Resumable + self-limited on YouTube quota. Run this ONCE. To stop later, run the uninstall line below.
set -e
HERE="$(dirname "$0")"
PLIST="$HOME/Library/LaunchAgents/net.metatake.filmclips.plist"
chmod +x "$HERE/worker/film-clips-daily.sh"
mkdir -p "$HOME/Library/LaunchAgents"
cp "$HERE/net.metatake.filmclips.plist" "$PLIST"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "✅ Scheduled: film-clips runs daily at 11:00."
echo "   • clip log:    worker/film-clips-cron.log"
echo "   • launchd log: worker/film-clips-launchd.log"
echo "   • check it's loaded:  launchctl list | grep metatake"
echo "   • stop later:         launchctl unload \"$PLIST\""
echo ""
echo "Press Enter to close..."; read -r _
