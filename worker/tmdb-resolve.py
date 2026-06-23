#!/usr/bin/env python3
"""TMDB id resolver for the +405 expansion (big-bang step 0/1).

Reads a films list (Film_TMDB_ID, Film_Title, Film_Director_Name) where tmdb_id is
blank, and for each title:
  1) /search/movie by title  → candidate movies
  2) disambiguate by DIRECTOR via /movie/{id}/credits (the safety net: title alone
     is ambiguous — many remakes/same names; the director makes the match certain)
  3) dedupe against existing films.tmdb_id AND normalized title
  4) write a resolved CSV with: tmdb_id, tmdb_title, tmdb_year, tmdb_director,
     confidence (high/medium/low), status (new/exists/unmatched), note.

It NEVER guesses silently: low-confidence + unmatched rows are printed for you to
eyeball (and hand-fix Film_TMDB_ID in the CSV, then re-run — rows that already have
a tmdb_id are trusted and not re-searched).

SAFETY: DRY by default (search + write CSV, NO DB writes).
  --persist : upsert NEW film rows (by tmdb_id, ignore-duplicates) — same row shape
              as mt-import.py (title/slug/year/director). Only status='new' rows with
              confidence high|medium are written unless --include-low is given.

Usage:
  python3 tmdb-resolve.py                      # DRY: resolve all, write resolved CSV
  python3 tmdb-resolve.py --limit 10           # DRY on first 10 (smoke test)
  python3 tmdb-resolve.py --persist            # upsert new film rows (high+medium)
  python3 tmdb-resolve.py --persist --include-low
  python3 tmdb-resolve.py --in path.csv --out path.csv

Env (worker/.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_READ_TOKEN
"""
import os, sys, csv, json, re, time, unicodedata, urllib.request, urllib.error, urllib.parse

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
if not (URL and KEY and TMDB):
    print("Missing env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + TMDB_READ_TOKEN in worker/.env.local)"); sys.exit(1)

args = sys.argv[1:]
PERSIST = "--persist" in args
INCLUDE_LOW = "--include-low" in args
LIMIT = int(args[args.index("--limit") + 1]) if "--limit" in args else 100000
DEFAULT_IN = os.path.join(ROOT, "metatake_films_expansion_405.csv")
DEFAULT_OUT = os.path.join(ROOT, "metatake_films_expansion_405_resolved.csv")
IN = args[args.index("--in") + 1] if "--in" in args else (DEFAULT_OUT if os.path.exists(DEFAULT_OUT) else DEFAULT_IN)
OUT = args[args.index("--out") + 1] if "--out" in args else DEFAULT_OUT

# ---------- http helpers ----------
def http(method, url, headers=None, body=None, timeout=60):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503): time.sleep(1.5 * (attempt + 1)); continue
            return e.code, e.read().decode()[:300]
        except Exception as e:
            time.sleep(1.0 * (attempt + 1));  last = str(e)
    return 0, locals().get("last", "error")

def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{URL}/rest/v1/{path}", h, body)

def tmdb(path):
    base = "https://api.themoviedb.org/3"
    if len(TMDB) > 40:  # v4 read access token
        url = base + path; headers = {"Authorization": f"Bearer {TMDB}", "accept": "application/json"}
    else:               # v3 api key
        sep = "&" if "?" in path else "?"; url = f"{base}{path}{sep}api_key={TMDB}"; headers = {"accept": "application/json"}
    st, tx = http("GET", url, headers)
    if st != 200: return None
    try: return json.loads(tx)
    except Exception: return None

# ---------- normalize ----------
def deaccent(s):  # "Almodóvar"→"Almodovar", "Cléo"→"Cleo", "8½"→"812"
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode("ascii")
def norm(s):  # title key (accent-insensitive)
    return re.sub(r"[^a-z0-9]", "", deaccent(s).lower())
def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", deaccent(s).lower()).strip("-"); return s[:80] or "x"
def nname(s):  # person key → token list, accent-insensitive
    return [t for t in re.sub(r"[^a-z ]", " ", deaccent(s).lower()).split() if t]
def director_match(want, got):
    """True if a wanted director name matches one of the credited directors."""
    w = nname(want)
    if not w: return False
    for g in got:
        gg = nname(g)
        if not gg: continue
        if set(w) == set(gg): return True
        if w[-1] == gg[-1] and (w[0][:1] == gg[0][:1]): return True   # surname + initial
        if want.lower().strip() and want.lower().strip() in g.lower(): return True
    return False

def search_movie(title):
    q = urllib.parse.quote(title)
    d = tmdb(f"/search/movie?query={q}&include_adult=false") or {}
    res = d.get("results", []) or []
    if not res:  # fallback: drop leading article / parenthetical
        alt = re.sub(r"\s*\([^)]*\)\s*", " ", title)
        alt = re.sub(r"^(the|a|an)\s+", "", alt.strip(), flags=re.I).strip()
        if alt and norm(alt) != norm(title):
            d = tmdb(f"/search/movie?query={urllib.parse.quote(alt)}&include_adult=false") or {}
            res = d.get("results", []) or []
    return res

def directors_of(mid):
    c = tmdb(f"/movie/{mid}/credits") or {}
    return [p.get("name", "") for p in c.get("crew", []) if p.get("job") == "Director"]

def person_fallback(title, director):
    """Last resort when title-search can't confirm the director (the correct film's
    TMDB title differs from the query AND many homonyms crowd it out, e.g. Murnau's
    'Sunrise' → 'Sunrise: A Song of Two Humans', Iñárritu's 'Bardo' → 'BARDO, …').
    Look up the DIRECTOR as a person and search THEIR filmography for the title."""
    if not director:
        return None
    p = tmdb(f"/search/person?query={urllib.parse.quote(director)}") or {}
    pres = p.get("results", []) or []
    if not pres:
        return None
    cr = tmdb(f"/person/{pres[0].get('id')}/movie_credits") or {}
    crew = [m for m in cr.get("crew", []) if m.get("job") == "Director"]
    nt = norm(title)
    cand = [m for m in crew if norm(m.get("title")) == nt or norm(m.get("original_title")) == nt]
    if not cand and nt:
        cand = [m for m in crew if nt in norm(m.get("title")) or nt in norm(m.get("original_title"))]
    if not cand:
        return None
    c = sorted(cand, key=lambda m: m.get("popularity", 0), reverse=True)[0]
    return dict(c, _dir=director, _conf="high", _note="via director filmography")

def resolve_one(title, director):
    res = search_movie(title)
    if not res:
        return person_fallback(title, director)
    nt = norm(title)
    res = sorted(res, key=lambda c: c.get("popularity", 0), reverse=True)
    exact = [c for c in res if norm(c.get("title")) == nt or norm(c.get("original_title")) == nt]
    eids = {c.get("id") for c in exact}
    # DIRECTOR is the real disambiguator: scan exact-title candidates first, then the
    # rest of the results (so a film whose TMDB canonical title differs — e.g. "Bardo"
    # → "Bardo, False Chronicle…" — is still found by its director).
    scan = exact + [c for c in res if c.get("id") not in eids]
    if director:
        for c in scan[:8]:
            ds = directors_of(c.get("id")); time.sleep(0.05)
            if director_match(director, ds):
                return dict(c, _dir=", ".join(ds), _conf="high",
                            _note=("exact-title+director" if c.get("id") in eids else "director match (loose title)"))
        pf = person_fallback(title, director)   # title-search couldn't confirm director → try their filmography
        if pf:
            return pf
    if exact:
        c = exact[0]; ds = directors_of(c.get("id")); time.sleep(0.05)
        return dict(c, _dir=", ".join(ds), _conf="medium", _note=f"title-only, NO director match ({len(exact)} exact-title candidates) — VERIFY")
    c = res[0]; ds = directors_of(c.get("id")); time.sleep(0.05)
    return dict(c, _dir=", ".join(ds), _conf="low", _note="best popularity guess, NO director match — VERIFY")

# ---------- existing films ----------
def fetch_existing():
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"films?select=tmdb_id,title,slug&limit=1000&offset={off}")
        if st != 200: print(f"  ! films read {st}: {tx[:200]}"); sys.exit(1)
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    ids = {str(r["tmdb_id"]) for r in rows if r.get("tmdb_id") is not None}
    titles = {norm(r["title"]) for r in rows if r.get("title")}
    slugs = {r["slug"] for r in rows if r.get("slug")}
    return ids, titles, slugs

# ---------- main ----------
def main():
    if not os.path.exists(IN): print(f"Input not found: {IN}"); sys.exit(1)
    rows = list(csv.DictReader(open(IN, encoding="utf-8-sig")))[:LIMIT]
    print(f"[resolve] input={os.path.basename(IN)} rows={len(rows)}  mode={'PERSIST' if PERSIST else 'DRY'}")
    exist_ids, exist_titles, exist_slugs = fetch_existing()
    print(f"[resolve] existing films: {len(exist_ids)} (tmdb_id) / {len(exist_titles)} (title keys)")

    out = []; counts = {"new": 0, "exists": 0, "unmatched": 0, "high": 0, "medium": 0, "low": 0}
    review = []
    for i, r in enumerate(rows, 1):
        title = (r.get("Film_Title") or "").strip()
        director = (r.get("Film_Director_Name") or "").strip()
        given = (r.get("Film_TMDB_ID") or "").strip()
        rec = {"Film_TMDB_ID": "", "Film_Title": title, "Film_Director_Name": director,
               "tmdb_title": "", "tmdb_year": "", "tmdb_director": "", "confidence": "", "status": "", "note": ""}
        if given.isdigit():  # trusted (prior resolve or hand-fix) — don't re-search
            rec["Film_TMDB_ID"] = given; rec["confidence"] = "given"; rec["note"] = "tmdb_id supplied"
            mv = tmdb(f"/movie/{given}")
            if mv:
                rec["tmdb_title"] = mv.get("title", ""); rec["tmdb_year"] = (mv.get("release_date") or "")[:4]
                rec["tmdb_director"] = ", ".join(directors_of(given))
        else:
            m = resolve_one(title, director)
            if not m:
                rec["status"] = "unmatched"; counts["unmatched"] += 1
                review.append(f"  ✗ UNMATCHED  {title}  (dir: {director})")
                out.append(rec); print(f"  [{i}/{len(rows)}] ✗ {title}"); continue
            rec["Film_TMDB_ID"] = str(m.get("id"))
            rec["tmdb_title"] = m.get("title", ""); rec["tmdb_year"] = (m.get("release_date") or "")[:4]
            rec["tmdb_director"] = m.get("_dir", ""); rec["confidence"] = m.get("_conf", ""); rec["note"] = m.get("_note", "")
            counts[m.get("_conf", "low")] += 1
        # dedupe status
        tid = rec["Film_TMDB_ID"]
        if tid and (tid in exist_ids or norm(title) in exist_titles):
            rec["status"] = "exists"; counts["exists"] += 1
        elif tid:
            rec["status"] = "new"; counts["new"] += 1
        if rec["confidence"] in ("low",) or rec["status"] == "unmatched":
            review.append(f"  ⚠ {rec['confidence'] or 'unmatched':7} {title}  →  {rec['tmdb_title']} ({rec['tmdb_year']}) dir:{rec['tmdb_director']}  [{rec['note']}]")
        out.append(rec)
        if i % 25 == 0 or i == len(rows): print(f"  [{i}/{len(rows)}] {title[:40]:40} → {rec['tmdb_title'][:30]} ({rec['tmdb_year']}) {rec['confidence']}/{rec['status']}")

    # write resolved CSV
    cols = ["Film_TMDB_ID", "Film_Title", "Film_Director_Name", "tmdb_title", "tmdb_year", "tmdb_director", "confidence", "status", "note"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(out)

    print("\n================ SUMMARY ================")
    print(f"  rows            : {len(out)}")
    print(f"  matched         : {len(out) - counts['unmatched']}  (high {counts['high']} · medium {counts['medium']} · low {counts['low']})")
    print(f"  → NEW films     : {counts['new']}")
    print(f"  → already exist : {counts['exists']}")
    print(f"  → UNMATCHED     : {counts['unmatched']}")
    print(f"  existing total  : {len(exist_ids)}")
    print(f"  PROJECTED TOTAL after load: {len(exist_ids) + counts['new']}")
    print(f"  resolved CSV    : {OUT}")
    if review:
        print("\n  --- REVIEW THESE (low-confidence / unmatched) ---")
        for line in review[:80]: print(line)
        print("  (hand-fix Film_TMDB_ID in the resolved CSV for any wrong ones, then re-run; given ids are trusted.)")

    if not PERSIST:
        print("\n[DRY] No DB writes. Review the CSV, then re-run with --persist to upsert NEW film rows.")
        return

    # ---- persist: upsert new film rows ----
    pick = [r for r in out if r["status"] == "new" and (r["confidence"] in ("high", "medium", "given") or INCLUDE_LOW)]
    skipped_low = [r for r in out if r["status"] == "new" and r["confidence"] == "low" and not INCLUDE_LOW]
    film_rows = []
    for r in pick:
        title = r["Film_Title"]; yr = r["tmdb_year"]
        year = int(yr) if (yr or "").isdigit() else None
        director = r["Film_Director_Name"] or (r["tmdb_director"].split(",")[0].strip() if r["tmdb_director"] else None)
        slug = (slugify(title) + ("-" + str(year) if year else ""))[:120]
        if slug in exist_slugs:  # avoid unique-slug collision with a different film
            slug = (slug + "-" + str(r["Film_TMDB_ID"]))[:120]
        film_rows.append({"tmdb_id": int(r["Film_TMDB_ID"]), "title": title, "year": year,
                          "director": director, "director_slug": slugify(director) if director else None, "slug": slug})
    print(f"\n[persist] upserting {len(film_rows)} new film rows (skipped {len(skipped_low)} low-confidence — re-run with --include-low to include)")
    for i in range(0, len(film_rows), 100):
        chunk = film_rows[i:i + 100]
        st, tx = sb("POST", "films?on_conflict=tmdb_id", chunk, prefer="resolution=ignore-duplicates,return=minimal")
        if st >= 300: print(f"  ! films insert {st}: {tx[:300]}"); sys.exit(1)
        print(f"  upserted {min(i + 100, len(film_rows))}/{len(film_rows)}")
    # verify
    st, tx = sb("GET", "films?select=count")
    print(f"[persist] done. films table now ~ {tx}")
    print("Next: run tmdb-fetch.py --persist (enrich the new films' metadata/media), then figure extraction.")

if __name__ == "__main__":
    main()
