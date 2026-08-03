#!/usr/bin/env python3
"""Filming-locations cartography compiler.

Compiles every mapped filming location on a published film into ONE static
artifact served from the web origin:

  public/geo/pins.v1.json    countries + films + pins

Why this exists (owner 2026-08-03): the app used to assemble the world map at
runtime from ten `/api/v1/locations?country=` calls plus ~28 Supabase round
trips for posters and TakeScores — roughly 38 requests against a production API,
for a result that still showed only ~2,000 of the 17,000 pins. One immutable
file replaces all of it, and the version lives in the filename so it can be
cached forever.

Same contract as worker/odyssey-build.py: a fixed, versioned artifact —
same inputs produce the same file, and personalisation stays a client overlay.

Shape (arrays, not objects — the field names would be half the payload):
  {
    "v": 1, "built": "YYYY-MM-DD", "pins": 17337,
    "countries": ["United States", ...],
    "films":  [[slug, title, poster_path|null, ts|null], ...],
    "pins":   [[name, countryIdx|-1, lat, lng, filmIdx], ...]
  }

Usage:
  python3 worker/locations-build.py            # writes public/geo/pins.v1.json
  python3 worker/locations-build.py --dry      # prints the summary only
"""
import json, os, sys, urllib.request, urllib.error
from datetime import date, timezone, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "geo")
OUT = os.path.join(OUT_DIR, "pins.v1.json")
DRY = "--dry" in sys.argv[1:]

# Coordinate precision: 5 decimals ≈ 1.1 m. Anything finer is noise on a phone
# screen and costs ~2 bytes per pin per axis.
PREC = 5


def load_env(p):
    if not os.path.exists(p):
        return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY):
    sys.exit("Missing SUPABASE env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)")


def http(method, path, body=None, extra=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", method=method, data=data)
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    # A missing UA trips Cloudflare 1010 on some Supabase edges (see apply-sql.py).
    req.add_header("User-Agent", "metatake-worker/1.0")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    for k, v in (extra or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def page(path, size=1000):
    """PostgREST caps every response at 1,000 rows — page through it."""
    out, off = [], 0
    while True:
        sep = "&" if "?" in path else "?"
        rows = http("GET", f"{path}{sep}limit={size}&offset={off}")
        out += rows
        if len(rows) < size:
            return out
        off += size


# ---------------------------------------------------------------- locations
# Published films only: a pin whose film has no page is a pin you cannot open.
SELECT = "select=name,lat,lng,country,film:films!inner(slug,title,poster_path,visible)&films.visible=is.true&lat=not.is.null&lng=not.is.null&order=name"
rows = page(f"film_locations?{SELECT}")
print(f"film_locations: {len(rows)} mapped pins on published films")

# ------------------------------------------------------------- take scores
slugs = sorted({r["film"]["slug"] for r in rows if r.get("film")})
ts_by_slug = {}
for i in range(0, len(slugs), 400):
    chunk = slugs[i : i + 400]
    try:
        for r in http("POST", "rpc/takescore_for_slugs", {"p_slugs": chunk}):
            if r.get("ts") is not None:
                ts_by_slug[r["slug"]] = round(float(r["ts"]))
    except urllib.error.HTTPError as e:  # scores are decoration, never a blocker
        print(f"  takescore chunk {i} failed: {e.code}", file=sys.stderr)
print(f"films: {len(slugs)} ({len(ts_by_slug)} scored)")

# ------------------------------------------------------------------ encode
countries, country_idx = [], {}
films, film_idx = [], {}
pins = []
for r in rows:
    f = r.get("film") or {}
    slug = f.get("slug")
    name = (r.get("name") or "").strip()
    if not slug or not name:
        continue
    if slug not in film_idx:
        film_idx[slug] = len(films)
        films.append([slug, f.get("title") or slug, f.get("poster_path"), ts_by_slug.get(slug)])
    c = (r.get("country") or "").strip()
    ci = -1
    if c:
        if c not in country_idx:
            country_idx[c] = len(countries)
            countries.append(c)
        ci = country_idx[c]
    pins.append([name, ci, round(float(r["lat"]), PREC), round(float(r["lng"]), PREC), film_idx[slug]])

artifact = {
    "v": 1,
    "built": date.today().isoformat(),
    "pins": len(pins),
    "countries": countries,
    "films": films,
    # Last on purpose: the small fields land first for anything reading a stream.
    "points": pins,
}
body = json.dumps(artifact, ensure_ascii=False, separators=(",", ":"))

print(f"countries: {len(countries)} · films: {len(films)} · pins: {len(pins)}")
print(f"artifact: {len(body) / 1024 / 1024:.2f} MB raw")

if DRY:
    sys.exit(0)

os.makedirs(OUT_DIR, exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write(body)
print(f"wrote {OUT}")
