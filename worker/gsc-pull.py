#!/usr/bin/env python3
"""gsc-pull — Google Search Console → mt_gsc_daily (day, page, query, clicks, impressions, ctr, position).

Feeds the GSC panels on /admin/metrics (per-page queries + clicks/impressions series),
joined against the first-party mt_events behaviour data in migration 0058.

Auth: a Google Cloud SERVICE ACCOUNT (no OAuth dance). One-time setup by the owner:
  1) console.cloud.google.com → create/select project → enable "Google Search Console API"
  2) IAM → Service Accounts → create (e.g. gsc-reader) → Keys → add JSON key
     → save it as worker/gsc-sa.json  (gitignored — never commit)
  3) search.google.com/search-console → Settings → Users and permissions
     → Add user → the service account's email (…@…iam.gserviceaccount.com), "Full" or "Restricted"

No pip deps: the RS256 JWT is signed by shelling out to `openssl`.

Env (repo .env.local or worker/.env.local):
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  GSC_SA_JSON      optional, path to the key file   (default worker/gsc-sa.json)
  GSC_PROPERTY     optional, e.g. sc-domain:metatake.net  or  https://metatake.net/

Usage:
  python3 worker/gsc-pull.py                       # DRY: fetch 1 day, print sample, no writes
  python3 worker/gsc-pull.py --persist             # upsert last 3 days (GSC lags ~2 days)
  python3 worker/gsc-pull.py --persist --days 90   # backfill
GSC data is final after ~3 days; the default 3-day window run daily keeps the table fresh.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load_env(p):
    if not os.path.exists(p):
        return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env(os.path.join(ROOT, ".env.local"))
load_env(os.path.join(HERE, ".env.local"))

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SA_PATH = os.environ.get("GSC_SA_JSON", os.path.join(HERE, "gsc-sa.json"))
PROPERTY = os.environ.get("GSC_PROPERTY", "sc-domain:metatake.net")

args = sys.argv[1:]
PERSIST = "--persist" in args
DAYS = int(args[args.index("--days") + 1]) if "--days" in args else (1 if not PERSIST else 3)
if "--property" in args:
    PROPERTY = args[args.index("--property") + 1]

if not (URL and KEY):
    print("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local")
    sys.exit(1)
if not os.path.exists(SA_PATH):
    print(f"Service-account key not found: {SA_PATH}\nSee the setup steps in this file's docstring.")
    sys.exit(1)


# ── service-account JWT → access token (openssl signs RS256, no pip deps) ──
def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def access_token() -> str:
    sa = json.load(open(SA_PATH, encoding="utf-8"))
    now = int(time.time())
    header = b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64url(json.dumps({
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/webmasters.readonly",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }).encode())
    signing_input = f"{header}.{claims}".encode()
    with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as kf:
        kf.write(sa["private_key"])
        key_path = kf.name
    try:
        sig = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_path],
            input=signing_input, capture_output=True, check=True,
        ).stdout
    finally:
        os.unlink(key_path)
    jwt = f"{header}.{claims}.{b64url(sig)}"
    body = f"grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion={jwt}".encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token", data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["access_token"]


# ── GSC search analytics, paged ─────────────────────────────────────────────
def gsc_rows(token: str, day: str):
    endpoint = (
        "https://www.googleapis.com/webmasters/v3/sites/"
        + urllib.parse.quote(PROPERTY, safe="") + "/searchAnalytics/query"
    )
    start = 0
    while True:
        payload = {
            "startDate": day, "endDate": day,
            "dimensions": ["page", "query"],
            "rowLimit": 25000, "startRow": start,
        }
        req = urllib.request.Request(
            endpoint, data=json.dumps(payload).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                rows = json.load(r).get("rows", [])
        except urllib.error.HTTPError as e:
            print(f"  GSC {day} HTTP {e.code}: {e.read().decode()[:300]}")
            return
        for row in rows:
            yield {
                "day": day,
                "page": row["keys"][0][:500],
                "query": row["keys"][1][:300],
                "clicks": int(row.get("clicks", 0)),
                "impressions": int(row.get("impressions", 0)),
                "ctr": row.get("ctr"),
                "position": row.get("position"),
            }
        if len(rows) < 25000:
            return
        start += 25000


# ── GSC daily TOTALS (date dimension) ───────────────────────────────────────
# The page+query request above cannot return anonymized queries — Google withholds
# rare/personal query strings entirely — so summing mt_gsc_daily undercounts, badly
# once the long tail is all that is left. Measured 2026-08-03: 130 impressions over
# 14 days by the page dimension, 4 by the page+query grid. The date dimension does
# return the full number, so it gets its own table (mt_gsc_totals, migration 0119).
def gsc_totals(token: str, day: str):
    endpoint = (
        "https://www.googleapis.com/webmasters/v3/sites/"
        + urllib.parse.quote(PROPERTY, safe="") + "/searchAnalytics/query"
    )
    payload = {"startDate": day, "endDate": day, "dimensions": ["date"], "rowLimit": 10}
    req = urllib.request.Request(
        endpoint, data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            rows = json.load(r).get("rows", [])
    except urllib.error.HTTPError as e:
        print(f"  totals {day} HTTP {e.code}: {e.read().decode()[:200]}")
        return None
    if not rows:
        return {"day": day, "clicks": 0, "impressions": 0, "ctr": None, "position": None}
    row = rows[0]
    return {
        "day": day,
        "clicks": int(row.get("clicks", 0)),
        "impressions": int(row.get("impressions", 0)),
        "ctr": row.get("ctr"),
        "position": row.get("position"),
    }


def upsert_totals(rows):
    if not rows:
        return
    req = urllib.request.Request(
        f"{URL}/rest/v1/mt_gsc_totals?on_conflict=day",
        data=json.dumps(rows).encode(),
        headers={
            "apikey": KEY, "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        r.read()


# ── Supabase upsert ────────────────────────────────────────────────────────
def upsert(rows):
    req = urllib.request.Request(
        f"{URL}/rest/v1/mt_gsc_daily?on_conflict=day,page,query",
        data=json.dumps(rows).encode(),
        headers={
            "apikey": KEY, "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        r.read()


token = access_token()
print(f"property={PROPERTY}  days={DAYS}  persist={PERSIST}")

total = 0
# GSC data lags ~2 days: walk the window ending 2 days ago
end = date.today() - timedelta(days=2)
for i in range(DAYS):
    day = (end - timedelta(days=i)).isoformat()
    batch, n = [], 0
    for row in gsc_rows(token, day):
        n += 1
        if not PERSIST:
            if n <= 5:
                print(" ", json.dumps(row, ensure_ascii=False)[:160])
            continue
        batch.append(row)
        if len(batch) >= 1000:
            upsert(batch)
            batch = []
    if PERSIST and batch:
        upsert(batch)
    tot = gsc_totals(token, day)
    if tot and PERSIST:
        upsert_totals([tot])
    total += n
    shown = f" | totals clicks={tot['clicks']} impr={tot['impressions']}" if tot else ""
    print(f"  {day}: {n} rows{'' if PERSIST else ' (dry)'}{shown}")

print(f"done — {total} rows{'' if PERSIST else ' (dry run, nothing written)'}")
