#!/usr/bin/env python3
"""next-resolve — match each "Watch next" recommendation to a DB film, else verify on TMDB.
Re-runnable: as the DB grows, previously non-DB recs can link up on a re-run.

Pipeline:
  next-all.jsonl ({slug, recs:[{title,year,director,reason}]})
    → (1) in-memory match against films (norm title + year±1 [+ director])  → target_film_id
    → (2) else TMDB search → tmdb_id → if tmdb_id ∈ films → target_film_id; else store tmdb_id+poster
    → (3) else drop (likely hallucination)
  → next-all.resolved.jsonl  (rows ready for next-load.py)

Usage: python3 next-resolve.py            # full
       python3 next-resolve.py --dry       # stats only, no TMDB-cache file write
"""
import os, sys, json, re, time, unicodedata, urllib.request, urllib.error, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
TMDB = os.environ.get("TMDB_READ_TOKEN")
SRC = os.path.join(HERE, "next-all.jsonl"); OUTF = os.path.join(HERE, "next-all.resolved.jsonl")
CACHE = os.path.join(HERE, "next-tmdb-cache.json")
DRY = "--dry" in sys.argv
if not (URL and KEY): sys.exit("Missing SUPABASE env")

def http(method, url, headers=None, timeout=30):
    req = urllib.request.Request(url, method=method)
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
    except Exception as e: return 0, str(e)

def to_int(v):
    try: return int(str(v)[:4])
    except Exception: return None
def deacc(s): return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
def norm(s):
    s = deacc((s or "").lower())
    s = re.sub(r"^(the|a|an)\s+", "", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()
def surname(d):
    d = re.sub(r"[^a-z ]", "", deacc((d or "").lower())).strip()
    return d.split()[-1] if d else ""

def load_films():
    films, off = [], 0
    while True:
        st, tx = http("GET", f"{URL}/rest/v1/films?select=id,slug,title,original_title,year,director,tmdb_id&order=id&limit=1000&offset={off}",
                      {"apikey": KEY, "Authorization": f"Bearer {KEY}"})
        if st != 200: sys.exit(f"films {st}: {tx[:160]}")
        b = json.loads(tx); films += b
        if len(b) < 1000: break
        off += 1000
    by_title = {}
    by_tmdb = {}
    by_slug = {}
    for f in films:
        by_slug[f["slug"]] = f
        if f.get("tmdb_id"): by_tmdb[f["tmdb_id"]] = f
        for t in (f.get("title"), f.get("original_title")):
            if t: by_title.setdefault(norm(t), []).append(f)
    return films, by_title, by_tmdb, by_slug

def match_db(rec, by_title):
    cands = by_title.get(norm(rec.get("title", "")), [])
    if not cands: return None
    ry = to_int(rec.get("year")); rs = surname(rec.get("director", ""))
    def score(f):
        yd = abs((f.get("year") or 0) - ry) if ry else 5
        ds = 0 if (rs and rs == surname(f.get("director", ""))) else 1
        return (ds, yd)
    cands = sorted(cands, key=score)
    best = cands[0]
    yd = abs((best.get("year") or 0) - (ry or 0)) if ry else 99
    rs_ok = rs and rs == surname(best.get("director", ""))
    if yd <= 1 or rs_ok:            # same title + (close year OR same director)
        return best
    return None

_cache = {}
if os.path.exists(CACHE):
    try: _cache = json.load(open(CACHE, encoding="utf-8"))
    except Exception: _cache = {}

def tmdb_search(title, year):
    if not TMDB: return None
    key = f"{norm(title)}|{year or ''}"
    c = _cache.get(key)
    if c: return c                                  # trust only successful (truthy) cache; retry None
    params = {"query": title, **({"year": year} if year else {})}
    if len(TMDB) > 40:                              # v4 read access token → Bearer
        u = "https://api.themoviedb.org/3/search/movie?" + urllib.parse.urlencode(params)
        hdr = {"Authorization": f"Bearer {TMDB}", "accept": "application/json"}
    else:                                           # v3 api key → query param
        params["api_key"] = TMDB
        u = "https://api.themoviedb.org/3/search/movie?" + urllib.parse.urlencode(params)
        hdr = {"accept": "application/json"}
    st, tx = http("GET", u, hdr)
    res = None
    if st == 200:
        arr = (json.loads(tx).get("results") or [])
        if arr:
            r0 = arr[0]
            res = {"tmdb_id": r0.get("id"),
                   "poster_path": r0.get("poster_path"),
                   "year": int((r0.get("release_date") or "0")[:4] or 0) or None}
    if res: _cache[key] = res                       # don't cache failures
    time.sleep(0.05)
    return res

def main():
    if not os.path.exists(SRC): sys.exit(f"missing {SRC} — run next-batch.py fetch first")
    films, by_title, by_tmdb, by_slug = load_films()
    print(f"films {len(films)} · tmdb-indexed {len(by_tmdb)}")
    recs_in = [json.loads(l) for l in open(SRC, encoding="utf-8") if l.strip()]
    out = []
    n_db = n_tmdb_link = n_tmdb_only = n_drop = n_rows = 0
    for film in recs_in:
        src = by_slug.get(film["slug"])
        if not src: continue
        seen = set(); pos = 0
        for rec in film.get("recs", []):
            title = (rec.get("title") or "").strip()
            if not title: continue
            target = match_db(rec, by_title)
            tmdb_id = poster = None
            if target:
                n_db += 1
            else:
                t = tmdb_search(title, to_int(rec.get("year")))
                if t and t.get("tmdb_id"):
                    tmdb_id, poster = t["tmdb_id"], t.get("poster_path")
                    if tmdb_id in by_tmdb:
                        target = by_tmdb[tmdb_id]; n_tmdb_link += 1
                    else:
                        n_tmdb_only += 1
                else:
                    n_drop += 1; continue          # not verifiable → drop
            tid = target["id"] if target else None
            dedup_key = tid or f"tmdb:{tmdb_id}" or norm(title)
            if dedup_key in seen: continue
            seen.add(dedup_key)
            pos += 1
            out.append({"source_slug": film["slug"], "source_film_id": src["id"], "position": pos,
                        "rec_title": title, "rec_year": to_int(rec.get("year")), "rec_director": rec.get("director", ""),
                        "reason": rec.get("reason", ""), "target_film_id": tid,
                        "tmdb_id": tmdb_id, "poster_path": poster})
            n_rows += 1
        if not DRY and len(_cache) % 1 == 0:
            pass
    if not DRY:
        with open(OUTF, "w", encoding="utf-8") as w:
            for r in out: w.write(json.dumps(r, ensure_ascii=False) + "\n")
        json.dump(_cache, open(CACHE, "w", encoding="utf-8"))
    total = n_db + n_tmdb_link + n_tmdb_only + n_drop
    print(f"\nresolved {n_rows} rows from {len(recs_in)} films")
    print(f"  in-DB (title/year): {n_db}")
    print(f"  TMDB→in-DB link:    {n_tmdb_link}")
    print(f"  TMDB-only (no link):{n_tmdb_only}")
    print(f"  dropped (no TMDB):  {n_drop}")
    print(f"  linkable total: {n_db+n_tmdb_link} / {total} recs ({(n_db+n_tmdb_link)/max(1,total)*100:.0f}%)")
    if not DRY: print(f"→ {OUTF}")

if __name__ == "__main__":
    main()
