#!/bin/bash
# One-shot Tier-2 noindex reception wave — invoked by the launchd LaunchAgent
# (net.metatake.t2noindex) so it SURVIVES LOGOUT/LOGIN/REBOOT, unlike a nohup loop
# (which loginwindow SIGKILLs on logout). launchd runs this on load + daily at 04:30.
#
# Each run: fetch academic-pending papers until OpenAlex's daily budget is spent, load
# ONLY if papers were filled (0-fill days skip the load → DB never regresses), revalidate
# the films that crossed the gate, refresh the cohort, log a measurement. Idempotent &
# self-limiting: no-ops once the addressable cohort is exhausted (~2-3 weeks).
#
# Install:   cp worker/net.metatake.t2noindex.plist ~/Library/LaunchAgents/ && \
#            launchctl load -w ~/Library/LaunchAgents/net.metatake.t2noindex.plist
# Stop:      launchctl unload -w ~/Library/LaunchAgents/net.metatake.t2noindex.plist
# Watch:     tail -f factory/logs/t2noindex-daily.log
PY=/usr/bin/python3
cd /Users/jerryje/Documents/MetaTake || exit 1
LOG=factory/logs/t2noindex-daily.log
mkdir -p factory/logs
echo "=== $(date) launchd wave start ===" >> "$LOG"
"$PY" worker/tier2noindex.py reception-wave --workers 2 >> "$LOG" 2>&1
"$PY" worker/tier2noindex.py revalidate            >> "$LOG" 2>&1
"$PY" worker/tier2noindex.py refresh               >> "$LOG" 2>&1
"$PY" worker/tier2noindex.py measure               >> "$LOG" 2>&1
echo "=== $(date) launchd wave done ===" >> "$LOG"
