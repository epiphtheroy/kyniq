#!/usr/bin/env python3
"""Odyssey map — data extraction.

Pulls the Tier-1 corpus and its map-building signals from Supabase REST
into local JSON files consumed by worker/odyssey-build.py.

Non-public schemas (curation.*, cinecodex.*) are fetched with an
Accept-Profile header; if the schema is not exposed over REST the run
prints FALLBACK:<schema> so the operator can pull those rows another way.

Usage: python3 worker/odyssey-extract.py [outdir]
"""
import json, os, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "worker", "odyssey_data")

def env():
    vals = {}
    with open(os.path.join(ROOT, ".env.local")) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals

E = env()
BASE = E["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = E["SUPABASE_SERVICE_ROLE_KEY"]

def fetch_all(path, params, profile=None, page=1000):
    rows, start = [], 0
    while True:
        q = "&".join(f"{k}={v}" for k, v in params.items())
        req = urllib.request.Request(f"{BASE}/rest/v1/{path}?{q}")
        req.add_header("apikey", KEY)
        req.add_header("Authorization", f"Bearer {KEY}")
        req.add_header("Range", f"{start}-{start + page - 1}")
        if profile:
            req.add_header("Accept-Profile", profile)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                chunk = json.loads(r.read())
        except urllib.error.HTTPError as e:
            print(f"FALLBACK:{profile or 'public'}:{path}:{e.code}:{e.read()[:200]}")
            return None
        rows.extend(chunk)
        if len(chunk) < page:
            return rows
        start += page

def save(name, rows):
    if rows is None:
        return
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(rows, f, ensure_ascii=False)
    print(f"{name}: {len(rows)} rows")

os.makedirs(OUT, exist_ok=True)

save("films.json", fetch_all("films", {
    "select": "id,tmdb_id,slug,title,title_ko,year,director,director_slug,genres,keywords,runtime,poster_path",
    "visible": "is.true", "order": "slug.asc"}))

save("prestige.json", fetch_all("film_scores", {
    "select": "film_id,prestige_score,discovery_score", "order": "film_id.asc"}))

# t-SNE embedding coordinates (worker/galaxy-build.py over film_taste_vector).
# This is what makes the map a similarity galaxy rather than a time grid.
save("mapxy.json", fetch_all("film_map_xy", {
    "select": "film_id,x,y,cluster", "order": "film_id.asc"}))

save("avail.json", fetch_all("film_provider_index", {
    "select": "film_id,country_code,provider_id,provider_name,kind",
    "country_code": "in.(KR,US)", "kind": "in.(flatrate,free,ads)",
    "order": "film_id.asc"}))

save("hubs.json", fetch_all("hub", {
    "select": "hub_slug,label,hub_type,country_code,region,status",
    "order": "hub_slug.asc"}, profile="curation"))

save("film_hub.json", fetch_all("film_hub", {
    "select": "tmdb_id,hub_slug,rank", "order": "tmdb_id.asc"}, profile="curation"))

# cinecodex.scores has multiple rows per film (prompt_version × panel), so the
# build needs one row per film keyed by slug. curation/cinecodex are not exposed
# over REST, so create a temp view that does the distinct-on join, extract it
# WITH an explicit order (unordered Range pagination silently drops rows), then
# drop it. Requires the SQL below to have been applied out-of-band:
#   create or replace view public.tmp_ody_codex2 as
#     select distinct on (f.id) f.slug, s.v_value, s.c_cost, s.r_risk, s.itx, s.fr
#     from cinecodex.scores s join public.films f on f.id = s.film_id
#     where f.visible order by f.id, s.scored_at desc nulls last;
codex = fetch_all("tmp_ody_codex2", {"select": "*", "order": "slug.asc"})
if codex is not None:
    save("codex.json", codex)
else:
    print("codex.json: FALLBACK — apply the tmp_ody_codex2 view (see header) then rerun")

print("done")
