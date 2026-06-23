#!/usr/bin/env bash
# Blog newsletter — REAL SEND to ALL active subscribers via Resend.
# Requires in ../.env.local:  RESEND_API_KEY  (+ existing SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL)
# AND a verified sender domain (metatake.net) in your Resend account, or Resend returns 403.
# Sends the LATEST published edition; refuses to re-send one already marked sent (use Terminal --force).
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Between Film and the World — REAL SEND (irreversible)."
echo "  • From: wonwoo@metatake.net   • To: all active subscribers"
echo "  • Tip: run the DRY preview first, and send yourself a --test."
echo
read -r -p "Type SEND to confirm a real blast (anything else cancels): " c
if [ "$c" != "SEND" ]; then echo "Cancelled — nothing sent."; echo "Press Enter to close..."; read -r _; exit 0; fi
python3 blog-send.py --send
echo
echo "Press Enter to close..."; read -r _
