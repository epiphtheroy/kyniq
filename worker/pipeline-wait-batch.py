#!/usr/bin/env python3
"""Wait until the batch-fetch has stopped writing figures/takes, then exit 0.

Polls Supabase every 30s; treats the batch as DONE once the newest figure AND
newest take are both older than QUIET seconds. Safety timeout so it never hangs.
Runs on the user's Mac (reads worker/.env.local like the other workers)."""
import os, sys, time, json, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8-sig"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); k = k.strip()
            if k.startswith("export "): k = k[7:].strip()
            os.environ.setdefault(k, v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY):
    print("  ! missing SUPABASE env — skipping wait, proceeding."); sys.exit(0)

QUIET = 180     # seconds of no writes = batch settled
POLL  = 30      # seconds between checks
MAXW  = 7200    # absolute safety cap (2h)

def latest(table):
    u = f"{URL}/rest/v1/{table}?select=created_at&order=created_at.desc&limit=1"
    req = urllib.request.Request(u)
    req.add_header("apikey", KEY); req.add_header("Authorization", f"Bearer {KEY}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.loads(r.read().decode())
        if not d: return None
        return datetime.fromisoformat(d[0]["created_at"].replace("Z", "+00:00"))
    except Exception as e:
        print(f"  ! poll error: {e}"); return None

t0 = time.time()
print(f"[wait] watching for the batch-fetch to settle (need quiet > {QUIET}s)…", flush=True)
while True:
    now = datetime.now(timezone.utc)
    ages = [(now - x).total_seconds() for x in (latest("figures"), latest("takes")) if x is not None]
    age = min(ages) if ages else 9999
    print(f"[wait] newest figure/take write {int(age)}s ago", flush=True)
    if age >= QUIET:
        print("[wait] batch settled — starting the pipeline."); break
    if time.time() - t0 > MAXW:
        print("[wait] safety timeout reached — starting anyway."); break
    time.sleep(POLL)
sys.exit(0)
