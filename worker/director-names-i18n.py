#!/usr/bin/env python3
"""director-names-i18n — the director's name in the reader's language.

Owner, 2026-08-07: the Tonight deck names every director in English under a
Korean title. The prose we already ship writes 봉준호 — the translator wrote it —
while the card beside it says "Bong Joon Ho".

SOURCE: Wikidata, reached by exact id and never by name.

    directors.tmdb_person_id
      → TMDB /person/{id}/external_ids   → wikidata_id
      → wbgetentities labels{ko,ja,zh,es,fr,hi}

Not TMDB's own also_known_as: it is empty for exactly the people who need it most
(Bong Joon Ho, Ozu, Kubrick) and where present it offers competing spellings with
no way to choose. Wikidata gives one label, the standard one.

Not name matching, ever. public.theorists was polluted to 22.5% that way; a QID
join cannot attach the wrong person.

One Wikidata call carries every language, so there is ONE cursor
(directors.names_fetched_at) and not six — same shape as tmdb-poster-i18n.py.

  python3 director-names-i18n.py --dry --limit 20
  python3 director-names-i18n.py --persist
  python3 director-names-i18n.py --persist --refill    # retry those with no ko label
  python3 director-names-i18n.py --persist --directors bong-joon-ho,yasujiro-ozu

Adding a language: add it to LOCALES and to migration 0139's column list.
lib/i18n/values.ts locVal() already reads the column.
"""
import datetime, json, os, sys, time, urllib.error, urllib.parse, urllib.request

# Unbuffered when redirected: a long run whose log stays empty is
# indistinguishable from one that hung, and this repo has lost hours to that.
try:
    sys.stdout.reconfigure(line_buffering=True)
except AttributeError:  # pragma: no cover
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

LOCALES = ["ko", "es", "ja", "zh", "fr", "hi"]
# wbgetentities accepts 50 ids per request. 871 directors is ~18 calls.
WD_BATCH = 50
STALE_DAYS = 365          # a person's standard spelling does not drift
THROTTLE = float(os.environ.get("I18N_THROTTLE", "0.05"))
# Wikimedia asks for a contactable UA and returns 403 to the default urllib one.
WD_UA = "MetatakeBot/1.0 (https://metatake.net; wonwoo@metatake.net) director-names-i18n"

args = sys.argv[1:]
PERSIST = "--persist" in args
if "--dry" in args: PERSIST = False
LIMIT = int(args[args.index("--limit") + 1]) if "--limit" in args else 100000
REFILL = "--refill" in args
DIRECTORS = (args[args.index("--directors") + 1].split(",") if "--directors" in args else None)


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


def get_json(url, headers=None, tries=3):
    """One read, retried on transport failure and on 429 — a socket reset in the
    middle of an 871-call run must not kill the pass."""
    for a in range(tries):
        try:
            st, tx = http("GET", url, headers)
        except Exception as e:
            if a == tries - 1:
                print(f"    ! net {type(e).__name__} {url[:60]}"); return None
            time.sleep(1.5 * (a + 1)); continue
        if st == 429:
            time.sleep(2 * (a + 1)); continue
        if st != 200:
            print(f"    ! http {st} {url[:70]}"); return None
        try: return json.loads(tx)
        except Exception: return None
    return None


def fetch_all(path):
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"{path}{'&' if '?' in path else '?'}limit=1000&offset={off}")
        if st != 200: raise RuntimeError(f"{st}: {tx[:200]}")
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    return rows


def cohort():
    cols = ",".join(f"name_{l}" for l in LOCALES)
    q = (f"directors?select=id,slug,name,tmdb_person_id,wikidata_id,names_fetched_at,{cols}"
         f"&tmdb_person_id=not.is.null")
    if DIRECTORS:
        q += "&slug=in.(" + ",".join(urllib.parse.quote(s) for s in DIRECTORS) + ")"
    elif REFILL:
        q += f"&name_{LOCALES[0]}=is.null"
    else:
        cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=STALE_DAYS)).isoformat()
        q += f"&or=(names_fetched_at.is.null,names_fetched_at.lt.{urllib.parse.quote(cutoff)})"
    q += "&order=slug"
    return fetch_all(q)[:LIMIT]


def qid_for(d):
    """The person's Wikidata id. Reuse a stored one — TMDB does not change it,
    and 871 avoidable calls is 871 avoidable ways to fail."""
    if d.get("wikidata_id"): return d["wikidata_id"]
    if not d.get("tmdb_person_id"): return None
    base = "https://api.themoviedb.org/3"
    path = f"/person/{d['tmdb_person_id']}/external_ids"
    if len(TMDB) > 40:
        j = get_json(base + path, {"Authorization": f"Bearer {TMDB}", "accept": "application/json"})
    else:
        j = get_json(f"{base}{path}?api_key={TMDB}", {"accept": "application/json"})
    time.sleep(THROTTLE)
    return (j or {}).get("wikidata_id") or None


def labels_for(qids):
    """{qid: {lang: label}} for up to WD_BATCH ids in one call."""
    out = {}
    for i in range(0, len(qids), WD_BATCH):
        chunk = qids[i:i + WD_BATCH]
        url = ("https://www.wikidata.org/w/api.php?action=wbgetentities"
               f"&ids={'|'.join(chunk)}&props=labels&languages={'|'.join(LOCALES)}&format=json")
        j = get_json(url, {"User-Agent": WD_UA, "accept": "application/json"})
        for q, ent in ((j or {}).get("entities") or {}).items():
            out[q] = {lang: v.get("value") for lang, v in (ent.get("labels") or {}).items() if v.get("value")}
        time.sleep(THROTTLE)
    return out


def main():
    ds = cohort()
    mode = "PERSIST" if PERSIST else "DRY — fetch+print, no DB writes"
    print(f"[names] {len(ds)} directors (locales={'/'.join(LOCALES)})  [{mode}]")
    if not ds: return

    started = time.time()
    with_qid = []
    for i, d in enumerate(ds, 1):
        q = qid_for(d)
        if q: with_qid.append((d, q))
        if i % 200 == 0:
            print(f"  qid {i}/{len(ds)} · {(time.time()-started)/60:.1f}m")
    print(f"[names] {len(with_qid)}/{len(ds)} carry a Wikidata id")

    labels = labels_for([q for _, q in with_qid])

    tally = {l: 0 for l in LOCALES}
    written = errs = 0
    for d, q in with_qid:
        found = {}
        for l in LOCALES:
            v = (labels.get(q) or {}).get(l)
            # A label identical to the English name carries no information, and
            # storing it would make "has a localized name" a lie later counts
            # believe — the same rule the title backfill applies.
            if v and v.strip() and v.strip() != (d.get("name") or "").strip():
                found[f"name_{l}"] = v.strip(); tally[l] += 1
        # Partial update: write what was found, always stamp the cursor and the
        # id. "Asked, found nothing" is an answer; without recording it the next
        # pass asks all 871 again.
        upd = dict(found); upd["names_fetched_at"] = "now()"; upd["wikidata_id"] = q
        if PERSIST:
            st, tx = sb("PATCH", f"directors?id=eq.{d['id']}", upd, prefer="return=minimal")
            if st not in (200, 204):
                print(f"    ! patch {st} {d['slug']}: {tx[:100]}"); errs += 1; continue
            written += 1
        else:
            print(f"  · {d['slug']}: {found.get('name_ko', '-')}")

    # Directors with no QID at all still get a cursor, or every run re-asks TMDB
    # about the same people forever.
    if PERSIST:
        for d, _ in [(x, None) for x in ds if x["slug"] not in {y["slug"] for y, _ in with_qid}]:
            sb("PATCH", f"directors?id=eq.{d['id']}", {"names_fetched_at": "now()"}, prefer="return=minimal")

    per = " · ".join(f"{l}={tally[l]}" for l in LOCALES)
    print(f"[names] {len(ds)} seen · qid {len(with_qid)} · localized ({per}) · written {written} · patch err {errs}")
    if not PERSIST: print("[names] DRY done — re-run with --persist to write.")


if __name__ == "__main__":
    main()
