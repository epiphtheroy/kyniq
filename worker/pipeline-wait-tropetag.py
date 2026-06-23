#!/usr/bin/env python3
"""Wait until trope-tag has finished, so run-pipeline-finish.command can be
double-clicked even while trope-tag is still running in another window.

Polls the row count of public.figure_tags every 60s; when it stops growing for
3 consecutive polls (~3 min quiet) — or a max wait elapses — tagging is done (or
stalled) and we proceed. Pure read; writes nothing.
"""
import os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY):
    print("Missing Supabase env"); sys.exit(1)

def count(path):
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", method="GET")
    req.add_header("apikey", KEY); req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Prefer", "count=exact"); req.add_header("Range", "0-0")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            cr = r.headers.get("Content-Range", "")
            return int(cr.split("/")[-1]) if "/" in cr else -1
    except urllib.error.HTTPError as e:
        cr = (e.headers or {}).get("Content-Range", "") if hasattr(e, "headers") else ""
        return int(cr.split("/")[-1]) if "/" in cr else -1
    except Exception:
        return -1

POLL = 60; STABLE_NEEDED = 3; MAX_MIN = 240
prev = -1; stable = 0; start = time.time()
print("[wait] watching figure_tags until trope-tag stops writing…", flush=True)
while True:
    c = count("figure_tags?select=tag")
    mins = (time.time() - start) / 60
    print(f"[wait] figure_tags={c}  stable={stable}/{STABLE_NEEDED}  ({mins:.0f}m)", flush=True)
    if c >= 0 and c == prev:
        stable += 1
    else:
        stable = 0
    prev = c
    if c >= 0 and stable >= STABLE_NEEDED:
        print(f"[wait] trope-tag complete — figure_tags steady at {c}. Proceeding."); break
    if mins > MAX_MIN:
        print("[wait] max wait reached — proceeding with whatever is tagged."); break
    time.sleep(POLL)
