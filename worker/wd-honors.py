#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""wd-honors.py — Wikidata 수상(P166)·후보(P1411) → film_wd_honors 백필(멱등).

imdb_id(P345)로 영화 매칭, SPARQL VALUES 배치(80편/쿼리). point-in-time(P585)의
정밀도(9=연도)를 year_only로 보존. 영화별 delete + insert. 비용 $0, LLM 0.

사용
  python3 worker/wd-honors.py --dry
  python3 worker/wd-honors.py --limit 160
  python3 worker/wd-honors.py
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


def rest(path: str, method: str = "GET", body=None, prefer: str | None = None):
    h = dict(H)
    if prefer:
        h["Prefer"] = prefer
    req = Request(f"{BASE}/rest/v1/{path}", method=method,
                  data=json.dumps(body).encode() if body is not None else None, headers=h)
    with urlopen(req, timeout=90) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw.strip() else None


def sparql(q: str, tries: int = 3):
    url = "https://query.wikidata.org/sparql?format=json&query=" + parse.quote(q)
    for a in range(tries):
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except HTTPError as e:
            if e.code in (429, 500, 502, 503) and a < tries - 1:
                time.sleep(8 * (a + 1))
                continue
            raise
    return None


def cohort():
    films, off = {}, 0
    # --all: every film with an imdb_id (Tier-2 backfill). Default: visible only.
    vis = "" if "--all" in sys.argv else "&visible=is.true"
    while True:
        page = rest(f"films?select=id,slug,imdb_id{vis}&imdb_id=not.is.null&order=slug&limit=1000&offset={off}")
        for f in page:
            films[f["imdb_id"]] = f
        if len(page) < 1000:
            break
        off += 1000
    return sorted(films.values(), key=lambda f: f["slug"])


Q = """SELECT ?imdb ?kind ?vLabel ?v ?time ?prec WHERE {
  VALUES ?imdb { %s }
  ?film wdt:P345 ?imdb.
  { ?film p:P166 ?st. ?st ps:P166 ?v. BIND("award" AS ?kind)
    OPTIONAL { ?st pqv:P585 ?tn. ?tn wikibase:timeValue ?time; wikibase:timePrecision ?prec. } }
  UNION
  { ?film p:P1411 ?st. ?st ps:P1411 ?v. BIND("nomination" AS ?kind)
    OPTIONAL { ?st pqv:P585 ?tn. ?tn wikibase:timeValue ?time; wikibase:timePrecision ?prec. } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}"""


def main():
    dry = "--dry" in sys.argv
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    films = cohort()
    if limit:
        films = films[:limit]
    print(f"cohort: {len(films)} films with imdb_id")
    by_imdb = {f["imdb_id"]: f for f in films}
    total = filled = 0
    for i in range(0, len(films), 80):
        batch = films[i:i + 80]
        vals = " ".join(f'"{f["imdb_id"]}"' for f in batch)
        try:
            r = sparql(Q % vals)
        except Exception as e:
            print(f"  ! sparql batch @{i}: {e}", file=sys.stderr)
            time.sleep(5)
            continue
        rows_by_film: dict[str, list] = {}
        seen = set()
        for b in r["results"]["bindings"]:
            imdb = b["imdb"]["value"]
            f = by_imdb.get(imdb)
            if not f:
                continue
            label = b.get("vLabel", {}).get("value", "")
            qid = b.get("v", {}).get("value", "").rsplit("/", 1)[-1]
            if not label or label == qid:
                continue  # unlabeled entity
            t = b.get("time", {}).get("value", "")[:10] or None
            prec = int(b.get("prec", {}).get("value", "11") or 11)
            k = (f["id"], b["kind"]["value"], qid, t)
            if k in seen:
                continue
            seen.add(k)
            rows_by_film.setdefault(f["id"], []).append({
                "film_id": f["id"], "kind": b["kind"]["value"], "label": label[:300],
                "event_date": t, "year_only": prec <= 9, "qid": qid,
            })
        if dry:
            print(f"batch @{i}: films-with-honors {len(rows_by_film)} · rows {sum(len(v) for v in rows_by_film.values())}")
            for fid, rows in list(rows_by_film.items())[:2]:
                for row in rows[:4]:
                    print("  ", row["kind"], "|", row["label"], "|", row["event_date"], "| year_only", row["year_only"])
            return
        for fid, rows in rows_by_film.items():
            try:
                rest(f"film_wd_honors?film_id=eq.{fid}", method="DELETE", prefer="return=minimal")
                rest("film_wd_honors", method="POST", body=rows, prefer="return=minimal")
                filled += 1
                total += len(rows)
            except HTTPError as e:
                print(f"  ! db {fid}: {e} {e.read()[:200]}", file=sys.stderr)
        print(f"  [{min(i + 80, len(films))}/{len(films)}] films-with-honors {filled} · rows {total}")
        time.sleep(1.5)
    print(f"✅ films with honors {filled} · honor rows {total}")


if __name__ == "__main__":
    main()
