#!/usr/bin/env bash
# One-time install: a background watcher that auto-commits & pushes my code edits
# (app/ components/ lib/ only) ~20s after they go quiet. Vercel then auto-builds.
# Uses your Mac's existing git/SSH — no tokens. Pause: create a file ".autodeploy-off"
# in the project folder. Uninstall: launchctl unload the plist below.
set -uo pipefail
cd "$(dirname "$0")"
chmod +x auto-deploy-watch.sh
mkdir -p "$HOME/Library/LaunchAgents"
cp net.metatake.autodeploy.plist "$HOME/Library/LaunchAgents/net.metatake.autodeploy.plist"
launchctl unload "$HOME/Library/LaunchAgents/net.metatake.autodeploy.plist" 2>/dev/null
launchctl load "$HOME/Library/LaunchAgents/net.metatake.autodeploy.plist"
echo "✅ Auto-deploy watcher installed and running."
echo "   • It auto-pushes edits under app/ components/ lib/ (Vercel builds them)."
echo "   • Pause: create an empty file named  .autodeploy-off  in this folder."
echo "   • Resume: delete that file."
echo "   • Log: .autodeploy.log in this folder."
echo "Press Enter to close..."; read -r _
