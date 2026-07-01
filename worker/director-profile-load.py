#!/usr/bin/env python3
"""director-profile-load — resolve Who's-Next recs + write Portrait & Who's-Next to the DB.

Reads worker/director-profile-all.jsonl ({slug, portrait, next:[{name,reason}]}):
  • Portrait → director_portrait (body, source='ai').
  • Each Who's-Next rec name → match to one of OUR directors (fuzzy norm; only directors that
    have a visible film, i.e. a real /director page). Unmatched → TMDB person search for a photo
    (tmdb_person_id + profile_path), target_slug stays null ("not yet on Metatake").
  → director_next rows (pos, rec_name, reason, target_slug, tmdb_person_id, profile_path).

DRY by default (stats + samples). --apply writes (replaces existing rows for the affected slugs).
Re-runnable: as the DB grows, unmatched recs link up on a re-run.

Usage: python3 director-profile-load.py --out worker/director-profile-all [--apply]
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
args = sys.argv[1:]
APPLY = "--apply" in args
OUT = args[args.index("--out") + 1] if "--out" in args else "worker/director-profile-all"
SRC = OUT + ".jsonl" if not OUT.endswith(".jsonl") else OUT
CACHE = os.path.join(HERE, "director-person-cache.json")
if not (URL and KEY): sys.exit("Missing SUPABASE env")

def http(method, url, headers=None, body=None, timeout=40):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    if body is not None: req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
    except Exception as e: return 0, str(e)
def sbh(): return {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
def sb_get(path):
    rows, off = [], 0
    while True:
        st, tx = http("GET", f"{URL}/rest/v1/{path}&limit=1000&offset={off}", sbh())
        if st != 200: raise RuntimeError(f"{st}: {tx[:160]}")
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    return rows

def deacc(s): return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
def norm(s):
    s = deacc((s or "").lower())
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

_cache = {}
if os.path.exists(CACHE):
    try: _cache = json.load(open(CACHE, encoding="utf-8"))
    except Exception: _cache = {}

def tmdb_person(name):
    if not TMDB: return None
    key = norm(name)
    if key in _cache: return _cache[key]                 # trust successful cache
    params = {"query": name}
    if len(TMDB) > 40:
        u = "https://api.themoviedb.org/3/search/person?" + urllib.parse.urlencode(params)
        hdr = {"Authorization": f"Bearer {TMDB}", "accept": "application/json"}
    else:
        params["api_key"] = TMDB
        u = "https://api.themoviedb.org/3/search/person?" + urllib.parse.urlencode(params)
        hdr = {"accept": "application/json"}
    st, tx = http("GET", u, hdr)
    res = None
    if st == 200:
        arr = (json.loads(tx).get("results") or [])
        if arr:
            r0 = arr[0]; res = {"tmdb_person_id": r0.get("id"), "profile_path": r0.get("profile_path")}
    if res: _cache[key] = res
    time.sleep(0.05)
    return res

def main():
    if not os.path.exists(SRC): sys.exit(f"missing {SRC} — run director-profile-batch.py fetch first")
    # our directors that have a real page (>=1 visible film)
    fds = sb_get("films?select=director_slug&visible=eq.true&director_slug=not.is.null")
    valid = set(f["director_slug"] for f in fds if f.get("director_slug"))
    drows = sb_get("directors?select=slug,name")
    idx = {}
    for d in drows:
        if d["slug"] in valid:
            idx[norm(d.get("name") or "")] = d["slug"]
    for s in valid:
        idx.setdefault(norm(s.replace("-", " ")), s)      # slug-words fallback (don't overwrite name match)

    items = [json.loads(l) for l in open(SRC, encoding="utf-8") if l.strip()]
    portraits = []; nexts = []
    n_match = n_person = n_none = 0
    samples = []
    for it in items:
        slug = it["slug"]
        body = (it.get("portrait") or "").strip()
        if body: portraits.append({"director_slug": slug, "body": body, "source": "ai"})
        pos = 0
        for rec in (it.get("next") or []):
            name = (rec.get("name") or "").strip(); reason = (rec.get("reason") or "").strip()
            if not name or not reason: continue
            pos += 1
            target = idx.get(norm(name))
            pid = profile = None
            if target:
                n_match += 1
            else:
                p = tmdb_person(name)
                if p: pid, profile = p.get("tmdb_person_id"), p.get("profile_path"); n_person += 1
                else: n_none += 1
            row = {"director_slug": slug, "pos": pos, "rec_name": name, "reason": reason,
                   "target_slug": target, "tmdb_person_id": pid, "profile_path": profile}
            nexts.append(row)
            if len(samples) < 12: samples.append(row)

    print(f"[director-profile-load] {'APPLY' if APPLY else 'DRY'} · directors {len(items)} · portraits {len(portraits)} · next rows {len(nexts)}")
    print(f"  Who's-Next resolution: matched-to-our-director {n_match} · TMDB-photo-only {n_person} · no-match {n_none}")
    print("  — sample —")
    for s in samples:
        tag = f"→ /director/{s['target_slug']}" if s["target_slug"] else ("(TMDB photo)" if s["profile_path"] else "(name only)")
        print(f"    [{s['director_slug']}] {s['rec_name']} {tag}")

    if not APPLY:
        json.dump(_cache, open(CACHE, "w", encoding="utf-8"))
        print("\nDRY — no writes. Re-run with --apply to write director_portrait + director_next.")
        return

    slugs = sorted(set(it["slug"] for it in items))
    def inlist(v): return "(" + ",".join(f'"{x}"' for x in v) + ")"
    for i in range(0, len(slugs), 80):
        chunk = slugs[i:i+80]
        http("DELETE", f"{URL}/rest/v1/director_portrait?director_slug=in.{inlist(chunk)}", {**sbh(), "Prefer": "return=minimal"})
        http("DELETE", f"{URL}/rest/v1/director_next?director_slug=in.{inlist(chunk)}", {**sbh(), "Prefer": "return=minimal"})
    def insert(table, rows):
        n = 0
        for i in range(0, len(rows), 500):
            c = rows[i:i+500]
            st, tx = http("POST", f"{URL}/rest/v1/{table}", {**sbh(), "Prefer": "return=minimal"}, c)
            if st >= 300: print(f"  ! {table} insert {st}: {tx[:160]}")
            else: n += len(c)
        return n
    np = insert("director_portrait", portraits)
    nn = insert("director_next", nexts)
    json.dump(_cache, open(CACHE, "w", encoding="utf-8"))
    print(f"\n✅ wrote {np} portraits + {nn} Who's-Next rows. Live within ISR (~5 min).")

if __name__ == "__main__":
    main()
