#!/bin/zsh
# Installs the launchd job that runs the newborn-film-site scanner daily at 09:30.
# Writes files only (state/review-queue.md) — it publishes NOTHING. Run once.
set -e
HERE="$(dirname "$0")"
PLIST="$HOME/Library/LaunchAgents/net.metatake.discovery.plist"
chmod +x "$HERE/discovery/scan-daily.sh"
mkdir -p "$HOME/Library/LaunchAgents" "$HERE/discovery/state"
cp "$HERE/net.metatake.discovery.plist" "$PLIST"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "✅ Scheduled: the discovery scan runs daily at 09:30."
echo "   • queue for your review:  discovery/state/review-queue.md"
echo "   • what the gate rejected: discovery/state/rejected.log"
echo "   • run log:                discovery/state/cron.log"
echo "   • pause:                  touch discovery/HOLD   (delete to resume)"
echo "   • check it's loaded:      launchctl list | grep metatake"
echo "   • stop later:             launchctl unload \"$PLIST\""
echo ""
echo "⚠️  The queue is TRIAGE, not approval. Open each site yourself before it goes"
echo "    into a digest — the classifier has passed phishing and piracy before."
echo ""
echo "Press Enter to close..."; read -r _
