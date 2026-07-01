#!/usr/bin/env python3
"""external-data — ratings (OMDb) + country watch channels (TMDB) per film.

Per film (by tmdb_id):
  1) TMDB /movie/{id}?append_to_response=external_ids,watch/providers
       → films.imdb_id (backfill)  +  film_watch_providers(results jsonb, countries[])
  2) OMDb ?i={imdb_id}  → film_ratings(imdb_rating, imdb_votes, metascore, rt_tomatometer)

Resumable: skips films that already have a providers row (TMDB) / ratings row (OMDb)
unless --refresh. Backoff/retry on 429/5xx. DRY by default.

Env (worker/.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  TMDB_READ_TOKEN, OMDB_API_KEY
Usage:
  python3 external-data.py                 # DRY: sample 6 films, no writes
  python3 external-data.py --persist       # write all films with a tmdb_id
  python3 external-data.py --persist --scope visible   # only visible films
  python3 external-data.py --persist --refresh         # re-fetch even if present
  python3 external-data.py --persist --limit 900       # cap this run (e.g. free OMDb tier)
"""
import os, sys, json, time, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
TMDB = os.environ.get("TMDB_READ_TOKEN"); OMDB = os.environ.get("OMDB_API_KEY")
args = sys.argv[1:]
PERSIST = "--persist" in args
REFRESH = "--refresh" in args
BACKDROPS = "--backdrops" in args   # lightweight: backfill films.backdrop_path/poster_path only (no OMDb/providers)
SCOPE = args[args.index("--scope") + 1] if "--scope" in args else "all"   # all | visible
LIMIT = int(args[args.index("--limit") + 1]) if "--limit" in args else (6 if not PERSIST else 100000)
if not (URL and KEY and TMDB):
    print("Missing env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + TMDB_READ_TOKEN in worker/.env.local)"); sys.exit(1)
if not OMDB:
    print("⚠ OMDB_API_KEY not set — ratings will be skipped (watch providers still run). Add OMDB_API_KEY to worker/.env.local.")

def http(method, url, headers=None, body=None, timeout=60):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None)
    if body is not None: req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
    except Exception as e: return 0, str(e)[:200]
def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{URL}/rest/v1/{path}", h, body)
def sb_all(path):
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"{path}{'&' if '?' in path else '?'}limit=1000&offset={off}")
        if st != 200: raise RuntimeError(f"{st}: {tx[:200]}")
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    return rows
def get_json(url, headers, tries=4):
    for a in range(tries):
        st, tx = http("GET", url, headers)
        if st == 200:
            try: return json.loads(tx)
            except Exception: return None
        if st in (429, 500, 502, 503, 520, 522, 0) and a < tries - 1:
            time.sleep(min(30, 5 * (a + 1))); continue
        print(f"    ! {st} {url[:60]}"); return None
    return None
def tmdb(path):
    base = "https://api.themoviedb.org/3"
    if len(TMDB) > 40:   # v4 read access token → Bearer
        return get_json(f"{base}{path}", {"Authorization": f"Bearer {TMDB}", "accept": "application/json"})
    sep = "&" if "?" in path else "?"   # v3 api key → query param
    return get_json(f"{base}{path}{sep}api_key={TMDB}", {"accept": "application/json"})
def omdb(imdb_id):
    if not OMDB: return None
    return get_json(f"https://www.omdbapi.com/?i={imdb_id}&apikey={OMDB}", {"accept": "application/json"})

def num(v):
    if not v or v == "N/A": return None
    try: return float(str(v).replace(",", ""))
    except Exception: return None
def integer(v):
    n = num(v); return int(n) if n is not None else None
def rt_of(ratings):
    for r in (ratings or []):
        if r.get("Source") == "Rotten Tomatoes":
            return integer(str(r.get("Value", "")).replace("%", ""))
    return None

def backfill_backdrops():
    """Fill films.backdrop_path (and poster_path if missing) for films that have none — TMDB base
    response carries both. 1 TMDB call per film, no OMDb/providers. Targets only the gap."""
    films = sb_all("films?select=id,slug,tmdb_id,backdrop_path,poster_path&tmdb_id=not.is.null&backdrop_path=is.null&order=slug")
    print(f"[external-data] {'PERSIST' if PERSIST else 'DRY'} · BACKDROPS · films missing backdrop {len(films)}")
    n = done = 0
    for f in films:
        if done >= LIMIT: break
        done += 1
        d = tmdb(f"/movie/{f['tmdb_id']}")
        if not d:
            continue
        patch = {}
        if d.get("backdrop_path"): patch["backdrop_path"] = d["backdrop_path"]
        if d.get("poster_path") and not f.get("poster_path"): patch["poster_path"] = d["poster_path"]
        if patch:
            if PERSIST:
                sb("PATCH", f"films?id=eq.{f['id']}", patch, prefer="return=minimal")
            n += 1
            if not PERSIST:
                print(f"   {f['slug']}: backdrop {patch.get('backdrop_path','—')}")
        time.sleep(0.1)
    print(f"\n{'✅ wrote' if PERSIST else 'DRY — would write'}: backdrops {n}")
    if not PERSIST: print("Re-run with --persist to write. (Live within ISR ~5 min after persist.)")

def main():
    if BACKDROPS:
        backfill_backdrops(); return
    where = "tmdb_id=not.is.null" + ("&visible=is.true" if SCOPE == "visible" else "")
    films = sb_all(f"films?select=id,slug,tmdb_id,imdb_id,backdrop_path,poster_path&{where}&order=slug")
    have_wp = {r["film_id"] for r in sb_all("film_watch_providers?select=film_id")}
    have_rt = {r["film_id"] for r in sb_all("film_ratings?select=film_id")}
    print(f"[external-data] {'PERSIST' if PERSIST else 'DRY'} · scope={SCOPE} · films {len(films)} · "
          f"have providers {len(have_wp)} · have ratings {len(have_rt)} · omdb={'on' if OMDB else 'OFF'}")
    n_wp = n_rt = n_skip = done = 0
    for f in films:
        if done >= LIMIT: break
        fid, slug, tid = f["id"], f["slug"], f["tmdb_id"]
        need_wp = REFRESH or fid not in have_wp
        need_rt = OMDB and (REFRESH or fid not in have_rt)
        if not need_wp and not need_rt:
            n_skip += 1; continue
        done += 1
        imdb = f.get("imdb_id")
        # 1) TMDB: external_ids (imdb) + watch/providers
        if need_wp:
            d = tmdb(f"/movie/{tid}?append_to_response=external_ids,watch/providers")
            if d:
                imdb = (d.get("external_ids") or {}).get("imdb_id") or imdb
                results = (d.get("watch/providers") or {}).get("results") or {}
                countries = sorted(results.keys())
                if PERSIST:
                    sb("POST", "film_watch_providers?on_conflict=film_id",
                       {"film_id": fid, "results": results, "countries": countries, "fetched_at": "now()"},
                       prefer="resolution=merge-duplicates,return=minimal")
                    patch = {}
                    if imdb and imdb != f.get("imdb_id"): patch["imdb_id"] = imdb
                    if d.get("backdrop_path") and not f.get("backdrop_path"): patch["backdrop_path"] = d["backdrop_path"]
                    if d.get("poster_path") and not f.get("poster_path"): patch["poster_path"] = d["poster_path"]
                    if patch:
                        sb("PATCH", f"films?id=eq.{fid}", patch, prefer="return=minimal")
                n_wp += 1
                if not PERSIST:
                    print(f"   {slug}: {len(countries)} countries · imdb {imdb or '—'}"
                          + (f" · KR {[p['provider_name'] for p in (results.get('KR',{}).get('flatrate') or [])]}" if results.get("KR") else ""))
        # 2) OMDb: ratings
        if need_rt and imdb:
            o = omdb(imdb)
            if o:
                row = {"film_id": fid, "imdb_rating": num(o.get("imdbRating")), "imdb_votes": integer(o.get("imdbVotes")),
                       "metascore": integer(o.get("Metascore")), "rt_tomatometer": rt_of(o.get("Ratings")), "fetched_at": "now()"}
                if PERSIST:
                    sb("POST", "film_ratings?on_conflict=film_id", row, prefer="resolution=merge-duplicates,return=minimal")
                n_rt += 1
                if not PERSIST:
                    print(f"      ↳ imdb {row['imdb_rating']} ({o.get('imdbVotes')}) · meta {row['metascore']} · RT {row['rt_tomatometer']}")
        time.sleep(0.15)
    print(f"\n{'✅ wrote' if PERSIST else 'DRY — would write'}: providers {n_wp} · ratings {n_rt} · skipped(existing) {n_skip}")
    if not PERSIST: print("Re-run with --persist to write. (Live within ISR ~5 min after persist.)")

if __name__ == "__main__":
    main()
