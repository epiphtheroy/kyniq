#!/usr/bin/env bash
# ============================================================
# Clears an ORPHANED git lock (.git/index.lock) — the thing that makes deploys
# say "Another git process seems to be running."
#
# SAFE: it only removes the lock when NO git process is actually running. If a
# real git process is mid-operation, it waits, and refuses rather than stomping it.
#
# Use: double-click this. When it says "Removed" (or "already unlocked"),
# double-click deploy-rag.command.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")"
echo "▶ Repo: $(pwd)"

if [ ! -f .git/index.lock ]; then
  echo "✓ No lock file present — git is already unlocked. Nothing to do."
  echo "Press Enter to close..."; read -r _; exit 0
fi

echo "• A .git/index.lock exists. Checking whether any git is actually running…"
for i in 1 2 3 4 5; do
  pgrep -x git >/dev/null 2>&1 || break
  echo "⏳ A git process is running — waiting for it to finish ($i/5)…"; sleep 3
done

if pgrep -x git >/dev/null 2>&1; then
  echo "✗ A git process is STILL running (another tool may be committing right now)."
  echo "  I did NOT touch anything. Wait ~30 seconds and double-click this file again."
  echo "Press Enter to close..."; read -r _; exit 1
fi

rm -f .git/index.lock
sleep 1
if [ -f .git/index.lock ]; then
  echo "✗ The lock reappeared immediately — a background process is recreating it."
  echo "  Wait ~30 seconds and double-click again."
  echo "Press Enter to close..."; read -r _; exit 1
fi

echo "✓ Removed the orphaned lock. git is unlocked."
echo "  → Now double-click  deploy-rag.command  to ship /rag."
echo "Press Enter to close..."; read -r _
