#!/usr/bin/env bash
# Start the app for a phone on the same Wi-Fi, and print a QR that actually works.
#
# Why a script: the Mac's LAN IP changes on DHCP renewal, and three places have to
# agree on it — Metro's advertised bundle URL, the app's API base, and the QR.
# When they drift, Expo Go connects and then fails to fetch the bundle. This
# detects the current IP every run and pins all three to it.
#
#   ./start-local.sh            # data server + Metro + QR page
#   ./start-local.sh --no-data  # Metro only (data already running, or PR #7 merged)
set -euo pipefail

cd "$(dirname "$0")"
MOBILE_DIR="$PWD"
REPO_DIR="$(cd .. && pwd)"
export PATH="$HOME/.local/node/bin:$PATH"

IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
[ -n "$IP" ] || IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$IP" ]; then
  echo "No Wi-Fi address found (en0/en1). Connect to Wi-Fi and retry." >&2
  exit 1
fi
echo "LAN IP: $IP"

# 1. Pin the app's API base to this IP (a phone cannot reach the Mac's localhost).
echo "EXPO_PUBLIC_METATAKE_BASE=http://$IP:3000" > .env.local
echo "API base: http://$IP:3000"

# 2. Data server (Next). Bound to 0.0.0.0 so the phone can reach it.
if [ "${1:-}" != "--no-data" ]; then
  if lsof -ti tcp:3000 >/dev/null 2>&1; then
    echo "Data server: already up on :3000"
  else
    ( cd "$REPO_DIR" && npm run dev -- --port 3000 --hostname 0.0.0.0 > /tmp/mt-web-dev.log 2>&1 & )
    echo "Data server: starting (log: /tmp/mt-web-dev.log)"
    sleep 12
  fi
  curl -s -m 30 -o /dev/null "http://$IP:3000/api/v1/app/services?country=US" || true
  code="$(curl -s -m 30 -o /dev/null -w '%{http_code}' "http://$IP:3000/api/v1/app/services?country=US")"
  echo "Data server check: HTTP $code (first hit after a cold start can 500 — it recompiles)"
fi

# 3. Metro. REACT_NATIVE_PACKAGER_HOSTNAME forces the manifest to advertise THIS
#    IP; without it Metro may pin a stale address and the phone fetches nothing.
for p in $(lsof -ti tcp:8081 2>/dev/null || true); do kill "$p" 2>/dev/null || true; done
sleep 2
REACT_NATIVE_PACKAGER_HOSTNAME="$IP" BROWSER=none \
  npx expo start --port 8081 --host lan > /tmp/mt-expo-lan.log 2>&1 &
echo "Metro: starting (log: /tmp/mt-expo-lan.log)"
sleep 25

# 4. Verify the manifest points at this IP, then render the QR.
ADV="$(curl -s -m 25 -H 'Expo-Platform: ios' -H 'Accept: multipart/mixed' "http://$IP:8081" \
       | grep -oE 'https?://[0-9.]+:8081' | head -1 || true)"
echo "Metro advertises: ${ADV:-unknown}"
if [ -n "$ADV" ] && [ "$ADV" != "http://$IP:8081" ]; then
  echo "WARNING: Metro is advertising $ADV, not http://$IP:8081 — Expo Go will fail." >&2
fi

node "$MOBILE_DIR/scripts/qr.mjs" "exp://$IP:8081" && open "/tmp/mt-phone-qr.html" || true
echo
echo "Scan the QR (Camera on iOS, Expo Go's scanner on Android)."
echo "Manual URL: exp://$IP:8081"
