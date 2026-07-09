#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ko-aliases.py — Korean (and alt) names → search_aliases, from Wikidata. Free, LLM 0.

Films   : films.wikidata_id (P-QID, ~6.8k) → rdfs:label@ko + skos:altLabel@ko.
Directors: directors.tmdb_person_id → Wikidata P4985 reverse → label@ko + altLabel@ko.

Feeds search_all v4 / film_search v3 (migration 0053): "기생충" → Parasite,
"봉준호" → Bong Joon Ho. Idempotent (unique (kind,slug,alias), upsert-ignore).

Usage
  python3 worker/ko-aliases.py --dry          # resolve first batches, print, no writes
  python3 worker/ko-aliases.py                # full backfill
  python3 worker/ko-aliases.py --limit 300    # cap films this run
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
UA = "MetatakeKoAliases/1.0 (thinkartist1@gmail.com)"
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


def fetch_all(path: str):
    rows, off = [], 0
    while True:
        page = rest(f"{path}{'&' if '?' in path else '?'}limit=1000&offset={off}")
        rows += page
        if len(page) < 1000:
            break
        off += 1000
    return rows


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


def insert_aliases(rows):
    """Upsert-ignore into search_aliases. rows: list of dicts."""
    if not rows or DRY:
        return len(rows)
    for i in range(0, len(rows), 500):
        rest("search_aliases?on_conflict=kind,slug,alias", "POST", rows[i:i + 500],
             prefer="resolution=ignore-duplicates,return=minimal")
    return len(rows)


def clean(alias: str, own_title: str | None) -> str | None:
    a = (alias or "").strip()
    if not a or len(a) > 120:
        return None
    if own_title and a.lower() == own_title.lower():
        return None  # same as the English title — no search value
    return a


def films():
    films = fetch_all("films?select=slug,title,wikidata_id&wikidata_id=not.is.null&order=slug")
    if LIMIT:
        films = films[:LIMIT]
    by_qid = {f["wikidata_id"]: f for f in films if f.get("wikidata_id", "").startswith("Q")}
    qids = list(by_qid.keys())
    print(f"[films] {len(qids)} films with QID{'  [DRY]' if DRY else ''}")
    total = 0
    for i in range(0, len(qids), 150):
        batch = qids[i:i + 150]
        vals = " ".join(f"wd:{q}" for q in batch)
        q = f'''SELECT ?f ?label ?alt WHERE {{
  VALUES ?f {{ {vals} }}
  OPTIONAL {{ ?f rdfs:label ?label FILTER(lang(?label)="ko") }}
  OPTIONAL {{ ?f skos:altLabel ?alt FILTER(lang(?alt)="ko") }}
}}'''
        try:
            res = sparql(q)
        except Exception as e:
            print(f"  ! films batch @{i}: {str(e)[:120]}")
            continue
        rows, seen = [], set()
        for b in res.get("results", {}).get("bindings", []):
            qid = b["f"]["value"].rsplit("/", 1)[-1]
            f = by_qid.get(qid)
            if not f:
                continue
            for key, src in (("label", "wikidata-label"), ("alt", "wikidata-alt")):
                a = clean(b.get(key, {}).get("value"), f["title"])
                if a and (f["slug"], a) not in seen:
                    seen.add((f["slug"], a))
                    rows.append({"kind": "film", "slug": f["slug"], "alias": a,
                                 "lang": "ko", "source": src})
        total += insert_aliases(rows)
        if DRY and rows:
            for r in rows[:8]:
                print(f"   · {r['slug']} ← {r['alias']}")
            print(f"  [DRY] first batch only → stopping films")
            break
        print(f"  [{min(i + 150, len(qids))}/{len(qids)}] aliases so far {total}")
        time.sleep(1)
    print(f"[films] {'DRY ' if DRY else ''}done: {total} alias rows")


def directors():
    ds = fetch_all("directors?select=slug,name,tmdb_person_id&tmdb_person_id=not.is.null&order=slug")
    by_tmdb = {str(d["tmdb_person_id"]): d for d in ds}
    ids = list(by_tmdb.keys())
    print(f"[directors] {len(ids)} directors with tmdb_person_id{'  [DRY]' if DRY else ''}")
    total = 0
    for i in range(0, len(ids), 150):
        batch = ids[i:i + 150]
        vals = " ".join(f'"{t}"' for t in batch)
        q = f'''SELECT ?tmdb ?label ?alt WHERE {{
  VALUES ?tmdb {{ {vals} }}
  ?p wdt:P4985 ?tmdb .
  OPTIONAL {{ ?p rdfs:label ?label FILTER(lang(?label)="ko") }}
  OPTIONAL {{ ?p skos:altLabel ?alt FILTER(lang(?alt)="ko") }}
}}'''
        try:
            res = sparql(q)
        except Exception as e:
            print(f"  ! directors batch @{i}: {str(e)[:120]}")
            continue
        rows, seen = [], set()
        for b in res.get("results", {}).get("bindings", []):
            d = by_tmdb.get(b["tmdb"]["value"])
            if not d:
                continue
            for key, src in (("label", "wikidata-label"), ("alt", "wikidata-alt")):
                a = clean(b.get(key, {}).get("value"), d["name"])
                if a and (d["slug"], a) not in seen:
                    seen.add((d["slug"], a))
                    rows.append({"kind": "director", "slug": d["slug"], "alias": a,
                                 "lang": "ko", "source": src})
        total += insert_aliases(rows)
        if DRY and rows:
            for r in rows[:8]:
                print(f"   · {r['slug']} ← {r['alias']}")
            print(f"  [DRY] first batch only → stopping directors")
            break
        print(f"  [{min(i + 150, len(ids))}/{len(ids)}] aliases so far {total}")
        time.sleep(1)
    print(f"[directors] {'DRY ' if DRY else ''}done: {total} alias rows")


if __name__ == "__main__":
    directors()
    films()
    print("✅ ko-aliases complete")
