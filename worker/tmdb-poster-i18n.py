#!/usr/bin/env python3
"""tmdb-poster-i18n — the poster in the reader's language.

Owner, 2026-08-07: a Korean app showing the US one-sheet is wrong. TMDB keys
every poster with an iso_639_1; Parasite carries 34 Korean posters beside 85
English ones. Where localized artwork exists, show it. Where it does not,
English is the right answer — never a blank.

Sibling of tmdb-i18n-backfill.py (titles) and deliberately shaped like it, with
ONE structural difference: /movie/{id}/images returns every language in a single
response, so one call fills all six locales at once and there is ONE cursor
(films.images_fetched_at) rather than six. Six per-locale cursors would mean six
passes over 7,158 films for data we already held on the first.

This is a DATA JOIN, not a derivation: we store TMDB's own file paths.

  python3 tmdb-poster-i18n.py --dry --limit 20        # look, write nothing (default is dry)
  python3 tmdb-poster-i18n.py --persist               # fill every film never fetched
  python3 tmdb-poster-i18n.py --persist --refill      # also retry films with no ko poster yet
  python3 tmdb-poster-i18n.py --persist --films parasite-2019,stalker-1979
  I18N_THROTTLE=0.15 python3 tmdb-poster-i18n.py --persist   # slower, when the DB is busy

Adding a language: add it to LOCALES here and to migration 0137's column list.
Nothing else changes — lib/i18n/values.ts locVal() already reads the column.
"""
import datetime, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

# Unbuffered when redirected. A long run whose log stays empty for twenty minutes
# is indistinguishable from a run that hung, and this repo has lost hours to that
# exact ambiguity — the answer is not to guess, it is to make progress visible.
try:
    sys.stdout.reconfigure(line_buffering=True)
except AttributeError:  # pragma: no cover — Python < 3.7
    pass

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)


def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
TMDB = os.environ.get("TMDB_READ_TOKEN")
if not (URL and KEY and TMDB):
    print("Missing env (SUPABASE url/service key + TMDB_READ_TOKEN)"); sys.exit(1)

# Mirrors lib/i18n/locales.ts minus 'en' — English is the source, films.poster_path.
LOCALES = ["ko", "es", "ja", "zh", "fr", "hi"]

# A localized poster narrower than this is a scan or a thumbnail, and swapping a
# 2000px English sheet for a 300px Korean one is a downgrade the reader would
# read as a bug. TMDB's own "original" size for a real poster is >= 1000px wide;
# 780 leaves room for legitimately smaller artwork without admitting scraps.
MIN_WIDTH = int(os.environ.get("POSTER_MIN_WIDTH", "780"))

STALE_DAYS = 180          # TMDB gains artwork over time; a NULL today is not NULL forever
THROTTLE = float(os.environ.get("I18N_THROTTLE", "0.05"))
CONC = int(os.environ.get("POSTER_CONC", "4"))

args = sys.argv[1:]
PERSIST = "--persist" in args
if "--dry" in args: PERSIST = False
LIMIT = int(args[args.index("--limit") + 1]) if "--limit" in args else 100000
REFILL = "--refill" in args
FILMS = (args[args.index("--films") + 1].split(",") if "--films" in args else None)


def http(method, url, headers=None, body=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None: req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{URL}/rest/v1/{path}", h, body)


def tmdb(path, tries=3):
    """One TMDB read, retried on transient transport failures.

    Without this a single `[Errno 54] Connection reset by peer` — routine over a
    7,000-call run — propagates out of the worker pool and kills the entire pass
    (how two title backfills died on 2026-08-03)."""
    base = "https://api.themoviedb.org/3"
    if len(TMDB) > 40:
        url = base + path; headers = {"Authorization": f"Bearer {TMDB}", "accept": "application/json"}
    else:
        sep = "&" if "?" in path else "?"
        url = f"{base}{path}{sep}api_key={TMDB}"; headers = {"accept": "application/json"}
    for a in range(tries):
        try:
            st, tx = http("GET", url, headers)
        except Exception as e:
            if a == tries - 1:
                print(f"    ! tmdb net {type(e).__name__} {path[:50]}"); return None
            time.sleep(1.5 * (a + 1)); continue
        if st == 429:
            time.sleep(2 * (a + 1)); continue
        if st != 200:
            print(f"    ! tmdb {st} {path[:60]}"); return None
        try: return json.loads(tx)
        except Exception: return None
    return None


def fetch_all(path):
    """PostgREST caps every response at 1000 rows — page through it."""
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"{path}{'&' if '?' in path else '?'}limit=1000&offset={off}")
        if st != 200: raise RuntimeError(f"{st}: {tx[:200]}")
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    return rows


def cohort():
    cols = ",".join(f"poster_path_{l}" for l in LOCALES)
    q = f"films?select=id,tmdb_id,slug,poster_path,images_fetched_at,{cols}&tmdb_id=not.is.null"
    if FILMS:
        q += "&slug=in.(" + ",".join(urllib.parse.quote(s) for s in FILMS) + ")"
    elif REFILL:
        # Films we have looked at but found nothing for in the FIRST locale. TMDB
        # adds artwork; without this they would never be asked again.
        q += f"&poster_path_{LOCALES[0]}=is.null"
    else:
        cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=STALE_DAYS)).isoformat()
        q += f"&or=(images_fetched_at.is.null,images_fetched_at.lt.{urllib.parse.quote(cutoff)})"
    q += "&order=slug"
    return fetch_all(q)[:LIMIT]


def best(posters, lang, default_path):
    """The poster a reader of `lang` should see, or None to keep English.

    Ranked by TMDB's own community vote, then by how many people voted, then by
    size. vote_average alone puts a single 10/10 upload above a 500-vote 8.0.
    """
    cands = [
        p for p in posters
        if p.get("iso_639_1") == lang
        and p.get("file_path")
        and (p.get("width") or 0) >= MIN_WIDTH
        # Identical to the English path carries no information — and writing it
        # would make "has a localized poster" a lie that later counts believe.
        and p.get("file_path") != default_path
    ]
    if not cands: return None
    cands.sort(key=lambda p: (p.get("vote_average") or 0, p.get("vote_count") or 0, p.get("width") or 0),
               reverse=True)
    return cands[0]["file_path"]


def process(f):
    d = tmdb(f"/movie/{f['tmdb_id']}/images")
    if d is None:
        time.sleep(THROTTLE)
        return {"miss": 1}
    posters = d.get("posters") or []
    default_path = (f.get("poster_path") or "").strip() or None
    found = {}
    for loc in LOCALES:
        p = best(posters, loc, default_path)
        if p: found[f"poster_path_{loc}"] = p

    # Partial update: only write what we found. Writing NULLs back would erase an
    # earlier run's values, and PATCHing rows where nothing changed churns the hot
    # films table for no gain (2026-07-17 incident: thousands of no-op PATCHes at
    # peak). The cursor is stamped either way — "asked, found nothing" is an
    # answer, and without recording it the next pass asks all 7,158 again.
    upd = dict(found); upd["images_fetched_at"] = "now()"
    if PERSIST:
        st, tx = sb("PATCH", f"films?id=eq.{f['id']}", upd, prefer="return=minimal")
        if st not in (200, 204):
            print(f"    ! patch {st} {f['slug']}: {tx[:120]}")
            time.sleep(THROTTLE)
            return {"err": 1}
    else:
        shown = " ".join(f"{k.split('_')[-1]}={v}" for k, v in found.items()) or "-"
        print(f"  · {f['slug']}: {shown}")
    time.sleep(THROTTLE)
    return {"seen": 1, "hits": len(found), **{f"loc_{k.split('_')[-1]}": 1 for k in found}}


def main():
    films = cohort()
    mode = "PERSIST" if PERSIST else "DRY — fetch+print, no DB writes"
    print(f"[posters] {len(films)} films (locales={'/'.join(LOCALES)}, min width {MIN_WIDTH}, conc {CONC})  [{mode}]")
    if not films: return
    tally = {}
    started = time.time()
    with ThreadPoolExecutor(max_workers=CONC) as ex:
        for i, r in enumerate(ex.map(process, films), 1):
            for k, v in (r or {}).items(): tally[k] = tally.get(k, 0) + v
            if PERSIST and i % 250 == 0:
                mins = (time.time() - started) / 60
                print(f"  [{i}/{len(films)}] hits={tally.get('hits',0)} · {mins:.1f}m")
    per = " · ".join(f"{l}={tally.get('loc_'+l,0)}" for l in LOCALES)
    print(f"[posters] {tally.get('seen',0)} seen · localized {tally.get('hits',0)} ({per})"
          f" · TMDB miss {tally.get('miss',0)} · patch err {tally.get('err',0)}")
    if not PERSIST: print("[posters] DRY done — re-run with --persist to write.")


if __name__ == "__main__":
    main()
