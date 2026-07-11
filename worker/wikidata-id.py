#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""wikidata-id.py — backfill films.wikidata_id from imdb_id via Wikidata (P345).

SPARQL VALUES batch (150 imdb/query) resolves imdb tt-id -> Q-id; PATCHes only
films whose wikidata_id is null (idempotent, resumable). Free (Wikidata SPARQL,
LLM 0). Feeds the Movie JSON-LD sameAs link on film pages.

Usage
  python3 worker/wikidata-id.py --dry        # resolve + print, no writes
  python3 worker/wikidata-id.py              # backfill (only null wikidata_id)
  python3 worker/wikidata-id.py --limit 300  # cap this run
"""
from __future__ import annotations
import json, os, sys, time
from urllib import parse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

BASE = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
UA = "Mozilla/5.0 (compatible; MetatakeBot/1.0; +https://metatake.net/bot)"
DRY = "--dry" in sys.argv
LIMIT = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None


def rest(path: str, method: str = "GET", body=None, prefer=None):
    h = dict(H)
    if prefer:
        h["Prefer"] = prefer
    req = Request(f"{BASE}/rest/v1/{path}", method=method,
                  data=json.dumps(body).encode() if body is not None else None, headers=h)
    with urlopen(req, timeout=90) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw.strip() else None


def sparql(q: str, tries: int = 4):
    url = "https://query.wikidata.org/sparql?format=json&query=" + parse.quote(q)
    for a in range(tries):
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode())
        except HTTPError as e:
            if e.code in (429, 500, 502, 503) and a < tries - 1:
                time.sleep(8 * (a + 1))
                continue
            raise


def cohort():
    films, off = {}, 0
    while True:
        page = rest(f"films?select=id,slug,imdb_id&wikidata_id=is.null&imdb_id=not.is.null&order=slug&limit=1000&offset={off}")
        for f in page:
            films[f["imdb_id"]] = f
        if len(page) < 1000:
            break
        off += 1000
    return sorted(films.values(), key=lambda f: f["slug"])


def main():
    films = cohort()
    if LIMIT:
        films = films[:LIMIT]
    print(f"cohort: {len(films)} films with imdb_id and no wikidata_id"
          f"{'  [DRY]' if DRY else ''}")
    if not films:
        print("nothing to do"); return
    by_imdb = {f["imdb_id"]: f for f in films}
    resolved = 0
    for i in range(0, len(films), 150):
        batch = films[i:i + 150]
        vals = " ".join(f'"{f["imdb_id"]}"' for f in batch)
        q = f'SELECT ?f ?imdb WHERE {{ VALUES ?imdb {{ {vals} }} ?f wdt:P345 ?imdb . }}'
        try:
            res = sparql(q)
        except Exception as e:
            print(f"  ! batch @{i}: {str(e)[:120]}")
            continue
        updates = {}
        for b in res.get("results", {}).get("bindings", []):
            imdb = b["imdb"]["value"]
            qid = b["f"]["value"].rsplit("/", 1)[-1]  # .../entity/Q123 -> Q123
            f = by_imdb.get(imdb)
            if f and imdb not in updates:  # first (avoid dup P345 collisions)
                updates[imdb] = (f, qid)
        for imdb, (f, qid) in updates.items():
            if DRY:
                print(f"  · {f['slug']}: {imdb} -> {qid}")
            else:
                rest(f"films?id=eq.{f['id']}", "PATCH", {"wikidata_id": qid}, prefer="return=minimal")
            resolved += 1
        print(f"  [{min(i + 150, len(films))}/{len(films)}] resolved {resolved}")
        time.sleep(1)
    print(f"{'DRY — ' if DRY else ''}✅ resolved wikidata_id for {resolved}/{len(films)} films")


if __name__ == "__main__":
    main()
