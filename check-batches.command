#!/usr/bin/env bash
# Check the live status of any submitted catalog batches (object / location / character).
# Reads the saved batch ids in Element/*.batch and asks Anthropic for each one's status.
# Does NOT submit, write, or change anything. Needs ANTHROPIC_API_KEY in .env.local.
set -uo pipefail
cd "$(dirname "$0")"
for p in "/opt/homebrew/bin" "/usr/local/bin"; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) PATH="$p:$PATH";; esac; done
export PATH
python3 - <<'PY'
import os, json, glob, urllib.request, urllib.error
root=os.path.dirname(os.path.abspath("."))
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(".env.local")
KEY=os.environ.get("ANTHROPIC_API_KEY")
if not KEY:
    print("⚠️  ANTHROPIC_API_KEY not in .env.local"); raise SystemExit
files=sorted(glob.glob("Element/*.batch"))
if not files:
    print("No submitted batches found (no Element/*.batch files)."); raise SystemExit
for f in files:
    bid=open(f).read().strip()
    req=urllib.request.Request(f"https://api.anthropic.com/v1/messages/batches/{bid}",
        headers={"x-api-key":KEY,"anthropic-version":"2023-06-01"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: j=json.loads(r.read().decode())
        print(f"{os.path.basename(f):34} {j.get('processing_status'):12} {j.get('request_counts')}")
    except urllib.error.HTTPError as e:
        print(f"{os.path.basename(f):34} ERROR {e.code}: {e.read().decode()[:150]}")
PY
echo
echo "If a batch shows 'ended', double-click run-catalog-map-character.command to retrieve + write it."
echo "Press Enter to close…"; read -r _
