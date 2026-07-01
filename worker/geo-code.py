#!/usr/bin/env python3
"""
geo-code.py — Geographic Atlas, stage 2 of 2 (geocoding).

Fills coordinates for `film_locations` rows that have lat/lng NULL. Dedupes the
place strings through `geo_cache` (each distinct name geocoded ONCE and reused →
re-runs cost ~nothing), then writes lat/lng/precision/country back to every row.

Geocoder: Google Geocoding if GOOGLE_MAPS_KEY is set (precise; 10k free/mo then
$5/1k), else Nominatim (free, 1 req/s). Resumable + cache-backed.

ENV: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
     GOOGLE_MAPS_KEY (optional → uses Google), GEO_WORKERS (default 4; forced 1 for Nominatim)

USAGE:
  python geo-code.py            # DRY: report distinct uncoded names + a sample geocode
  python geo-code.py --apply    # geocode + write coords (run after geo-extract.py --apply)
"""
import os, sys, json, time, urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

def load_env(p):
    try:
        for line in open(p):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except FileNotFoundError: pass
for f in (".env.local", ".env"): load_env(os.path.join(os.path.dirname(__file__), "..", f))

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GKEY = os.environ.get("GOOGLE_MAPS_KEY")
if not (URL and KEY): sys.exit("Missing Supabase env")
args = sys.argv[1:]; APPLY = "--apply" in args
WORKERS = 1 if not GKEY else int(os.environ.get("GEO_WORKERS", "4"))

def http(method, url, headers=None, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(5):
        req = urllib.request.Request(url, method=method, data=data)
        if body is not None: req.add_header("Content-Type", "application/json")
        for k, v in (headers or {}).items(): req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
        except urllib.error.HTTPError as e:
            code = e.code; tx = e.read().decode()[:300]
            if code in (429,500,502,503,504) and attempt < 4: time.sleep(2*(attempt+1)); continue
            return code, tx
        except (urllib.error.URLError, OSError):
            if attempt == 4: raise
            time.sleep(2*(attempt+1))
def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{URL}/rest/v1/{path}", h, body)
def fetch_all(path, page=1000):
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"{path}&limit={page}&offset={off}")
        if st != 200: raise RuntimeError(f"fetch {st}: {tx[:160]}")
        b = json.loads(tx); rows += b
        if len(b) < page: break
        off += page
    return rows
def norm(name): return " ".join(name.lower().split())

G_PREC = {"ROOFTOP": "exact", "RANGE_INTERPOLATED": "street", "GEOMETRIC_CENTER": "area", "APPROXIMATE": "region"}
def geocode_google(name):
    q = urllib.parse.urlencode({"address": name, "key": GKEY})
    st, tx = http("GET", f"https://maps.googleapis.com/maps/api/geocode/json?{q}")
    if st != 200: return None
    j = json.loads(tx)
    if j.get("status") != "OK" or not j.get("results"): return None
    r = j["results"][0]; loc = r["geometry"]["location"]
    prec = G_PREC.get(r["geometry"].get("location_type"), "area")
    types = r.get("types", [])
    if "country" in types: prec = "country"
    elif "locality" in types and prec not in ("exact", "street"): prec = "city"
    country = next((c["long_name"] for c in r.get("address_components", []) if "country" in c.get("types", [])), None)
    return {"lat": loc["lat"], "lng": loc["lng"], "precision": prec, "country": country}
def geocode_nominatim(name):
    q = urllib.parse.urlencode({"q": name, "format": "json", "limit": 1, "addressdetails": 1})
    st, tx = http("GET", f"https://nominatim.openstreetmap.org/search?{q}",
                  {"User-Agent": "metatake-atlas/1.0 (channel.wonwoo@gmail.com)"})
    time.sleep(1.1)  # nominatim policy: ≤1 req/s
    if st != 200: return None
    arr = json.loads(tx)
    if not arr: return None
    r = arr[0]; cls = r.get("type", "")
    prec = "city" if r.get("addresstype") in ("city", "town", "village") else "area"
    if r.get("addresstype") == "country": prec = "country"
    country = (r.get("address") or {}).get("country")
    return {"lat": float(r["lat"]), "lng": float(r["lon"]), "precision": prec, "country": country}
def geocode(name): return (geocode_google if GKEY else geocode_nominatim)(name)

def main():
    rows = fetch_all("film_locations?select=name&lat=is.null")
    names = sorted({r["name"] for r in rows if r.get("name")})
    print(f"uncoded film_locations rows: {len(rows)} · distinct names: {len(names)} · geocoder: {'Google' if GKEY else 'Nominatim'}")
    if not names: print("nothing to do."); return
    cache = {norm(c["name_norm"] if False else c["name"]): c for c in fetch_all("geo_cache?select=name,lat,lng,precision,country")}
    need = [n for n in names if norm(n) not in cache]
    print(f"cache hits: {len(names)-len(need)} · to geocode: {len(need)}")
    if not APPLY:
        sample = need[:5]
        print("DRY — sample geocodes:")
        for n in sample:
            g = geocode(n); print(f"  {n!r} → {g}")
        print("re-run with --apply to geocode all + write coords.")
        return
    # geocode the misses → geo_cache
    new = {}
    def work(n):
        g = geocode(n); return n, g
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for i, fut in enumerate(as_completed([ex.submit(work, n) for n in need]), 1):
            n, g = fut.result()
            if g: new[norm(n)] = {**g, "name": n}
            if i % 50 == 0: print(f"  geocoded {i}/{len(need)}")
    if new:
        crows = [{"name_norm": k, "name": v["name"], "lat": v["lat"], "lng": v["lng"],
                  "precision": v["precision"], "country": v.get("country"), "source": "google" if GKEY else "nominatim"} for k, v in new.items()]
        for i in range(0, len(crows), 200):
            st, tx = sb("POST", "geo_cache", crows[i:i+200], prefer="resolution=merge-duplicates")
            if st >= 300: print(f"  cache write {st}: {tx[:160]}", file=sys.stderr)
    cache.update(new)
    # write coords back to film_locations (by name, where lat null)
    wrote = 0
    for n in names:
        c = cache.get(norm(n))
        if not c: continue
        patch = {"lat": c["lat"], "lng": c["lng"], "precision": c.get("precision"), "country": c.get("country")}
        st, tx = sb("PATCH", f"film_locations?lat=is.null&name=eq.{urllib.parse.quote(n)}", patch)
        if st < 300: wrote += 1
        else: print(f"  patch {st} for {n!r}: {tx[:120]}", file=sys.stderr)
    print(f"geocoded {len(new)} new names · updated film_locations for {wrote} names. Done.")

if __name__ == "__main__": main()
