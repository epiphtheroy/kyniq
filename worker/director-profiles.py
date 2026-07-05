#!/usr/bin/env python3
"""Director profile photos via TMDB person search -> director_profile table.

For every director on the galaxy (director_map_xy), searches TMDB for the name,
prefers candidates whose known_for_department is Directing, and verifies by
overlapping known_for titles with the director's own films when possible.
Rows: (slug, tmdb_person_id, profile_path, method verified|dept|first|none).
Idempotent upsert; safe to re-run. Needs TMDB_READ_TOKEN (v4 bearer or v3 key).

Usage: python3 director-profiles.py [--force]   (--force re-fetches existing)
"""
import os, sys, json, urllib.request, urllib.error, urllib.parse
from concurrent.futures import ThreadPoolExecutor

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
if not (URL and KEY and TMDB): print("Missing env"); sys.exit(1)
IS_V4 = TMDB.startswith("eyJ")

def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    for k, v in h.items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]

def fetch_all(path):
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"{path}&limit=1000&offset={off}")
        if st != 200: raise RuntimeError(f"{st}: {tx[:200]}")
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    return rows

def tmdb_search(name):
    q = urllib.parse.quote(name)
    url = f"https://api.themoviedb.org/3/search/person?query={q}&include_adult=false&page=1"
    if not IS_V4: url += f"&api_key={TMDB}"
    req = urllib.request.Request(url)
    if IS_V4: req.add_header("Authorization", f"Bearer {TMDB}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode()).get("results", [])
    except Exception:
        return []

def main():
    force = "--force" in sys.argv[1:]
    dirs = fetch_all("director_map_xy?select=slug&order=slug")
    have = set() if force else {r["slug"] for r in fetch_all("director_profile?select=slug&order=slug")}
    films = fetch_all("films?select=director_slug,director,title&visible=eq.true&director_slug=not.is.null&order=id")
    name_of, titles_of = {}, {}
    for f in films:
        s = f["director_slug"]
        if f.get("director"): name_of.setdefault(s, f["director"])
        titles_of.setdefault(s, set()).add((f.get("title") or "").lower())

    todo = [d["slug"] for d in dirs if d["slug"] not in have and d["slug"] in name_of]
    print(f"[profiles] directors={len(dirs)} todo={len(todo)}")

    def resolve(slug):
        name = name_of[slug]
        results = tmdb_search(name)
        if not results: return {"slug": slug, "tmdb_person_id": None, "profile_path": None, "method": "none"}
        our = titles_of.get(slug, set())
        best, method = None, "first"
        for r in results[:6]:
            kf = {(k.get("title") or k.get("name") or "").lower() for k in (r.get("known_for") or [])}
            if our & kf:
                best, method = r, "verified"; break
        if best is None:
            for r in results[:6]:
                if r.get("known_for_department") == "Directing":
                    best, method = r, "dept"; break
        if best is None:
            best = results[0]
        return {"slug": slug, "tmdb_person_id": best.get("id"),
                "profile_path": best.get("profile_path"), "method": method}

    out = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for i, row in enumerate(ex.map(resolve, todo), 1):
            out.append(row)
            if i % 100 == 0: print(f"[profiles] …{i}/{len(todo)}", flush=True)

    for i in range(0, len(out), 300):
        st, tx = sb("POST", "director_profile?on_conflict=slug", out[i:i + 300],
                    prefer="resolution=merge-duplicates,return=minimal")
        if st >= 300: print(f"[profiles] upsert {st}: {tx[:200]}"); sys.exit(1)
    with_photo = sum(1 for r in out if r["profile_path"])
    print(f"[profiles] wrote {len(out)} rows, {with_photo} with photos "
          f"({sum(1 for r in out if r['method']=='verified')} verified)")

if __name__ == "__main__": main()
