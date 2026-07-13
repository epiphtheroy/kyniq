#!/usr/bin/env python3
"""export-locations-dataset — build the open CC BY filming-locations dataset.

Paginates public.api_locations_export() via the Supabase Management API (token
from .env.local, same as apply-sql.py) and writes CSV + JSONL + a stats summary
to datasets/filming-locations/. Coordinates INCLUDED — this is the deliberately
open geodata channel (owner decision 2026-07-13). Run: python3 export-locations-dataset.py
"""
import os, sys, json, csv, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]; PROJECT = "jvgarcqrtsmgfimdcwgo"
OUT = os.path.join(ROOT, "datasets", "filming-locations"); os.makedirs(OUT, exist_ok=True)

def query(sql):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        method="POST", data=json.dumps({"query": sql}).encode())
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "metatake-worker/1.0 (supabase management api client)")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode())

FIELDS = ["film_slug","film_title","film_year","imdb_id","tmdb_id","name","role",
          "narrative_setting","layer","kind","country","lat","lng","precision","confidence"]

rows, after = [], None
while True:
    esc = "null" if after is None else "'" + after.replace("'", "''") + "'"
    res = query(f"select public.api_locations_export({esc}, 5000) as r")
    payload = res[0]["r"] if res and "r" in res[0] else res[0]
    batch = payload.get("rows", [])
    rows.extend(batch)
    nxt = payload.get("next_after")
    print(f"  fetched {len(batch)} (total {len(rows)})", file=sys.stderr)
    if not nxt or len(batch) == 0:
        break
    after = nxt

# CSV
with open(os.path.join(OUT, "metatake-filming-locations.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore"); w.writeheader()
    for r in rows: w.writerow(r)
# JSONL
with open(os.path.join(OUT, "metatake-filming-locations.jsonl"), "w", encoding="utf-8") as f:
    for r in rows: f.write(json.dumps({k: r.get(k) for k in FIELDS}, ensure_ascii=False) + "\n")

films = len({r["film_slug"] for r in rows})
countries = len({r.get("country") for r in rows if r.get("country")})
geocoded = sum(1 for r in rows if r.get("lat") is not None and r.get("lng") is not None)
stats = {"rows": len(rows), "films": films, "countries": countries,
         "with_coordinates": geocoded, "coordinate_pct": round(100*geocoded/max(len(rows),1), 1)}
json.dump(stats, open(os.path.join(OUT, "STATS.json"), "w"), indent=2)
print(json.dumps(stats, indent=2))
