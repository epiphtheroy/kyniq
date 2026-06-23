#!/usr/bin/env bash
# Blog newsletter — DRY preview (sends NOTHING).
# Renders the latest published edition to email HTML (worker/blog-email-preview.html)
# and prints the subject + active-subscriber count. Safe to run anytime.
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Between Film and the World — DRY preview (no email sent)"
python3 blog-send.py
echo
echo "Open worker/blog-email-preview.html to see the email."
echo "Send a test:  in Terminal →  cd worker && python3 blog-send.py --test you@you.com"
echo "Press Enter to close..."; read -r _
