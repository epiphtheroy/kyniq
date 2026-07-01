#!/usr/bin/env python3
"""lineage-resolve — Phase 2 of the Lineage layer: complete the universe.

Phase 1 attached memberships only to films we already had. Phase 2 resolves the REST of the
lineage universe (films_master.csv, 6,733) to TMDB and:
  • if the resolved tmdb_id is already in our films (we only missed it on a title spelling) →
    attach its memberships to that existing film (boosts existing coverage, no stub);
  • else → create a STUB film (visible=false, hold=true, is_analyzed=false, in_seed_catalog=false)
    so canon/award lists become complete, then attach its memberships.

Stubs never appear on the curated site (invisible + the minimal noindex page). Phase 1 rows are
left untouched; Phase 2 only ADDS rows for newly-resolved films.

Resumable: TMDB resolutions cached in worker/lineage-tmdb-cache.json.

Usage:
  python3 lineage-resolve.py                 # DRY (TMDB resolve + report, fills cache, no DB writes)
  python3 lineage-resolve.py --limit 300     # DRY on a slice (testing)
  python3 lineage-resolve.py --apply         # create stubs + attach memberships
"""
import os, sys, json, re, csv, time, uuid, unicodedata, urllib.request, urllib.error, urllib.parse
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
HANDOFF = os.path.join(ROOT, "handoff")
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
LIMIT = int(args[args.index("--limit") + 1]) if "--limit" in args else 100000
CACHE = os.path.join(HERE, "lineage-tmdb-cache.json")
OUT = os.path.join(HERE, "lineage-resolve-dry.md")
csv.field_size_limit(10_000_000)
if not (URL and KEY and TMDB): sys.exit("Missing env (SUPABASE URL/SERVICE_ROLE + TMDB_READ_TOKEN)")

def http(method, url, headers=None, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    if body is not None: req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    for a in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503): time.sleep(1.5 * (a + 1)); continue
            return e.code, e.read().decode()[:300]
        except Exception as e:
            time.sleep(1.0 * (a + 1)); last = str(e)
    return 0, locals().get("last", "error")
def sbh(extra=None): return {"apikey": KEY, "Authorization": f"Bearer {KEY}", **(extra or {})}
def sb_get(path):
    rows, off = [], 0
    while True:
        st, tx = http("GET", f"{URL}/rest/v1/{path}{'&' if '?' in path else '?'}limit=1000&offset={off}", sbh())
        if st != 200: raise RuntimeError(f"GET {path} {st}: {tx[:160]}")
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    return rows
def sb_insert(table, rows, chunk=500):
    n = 0
    for i in range(0, len(rows), chunk):
        c = rows[i:i+chunk]
        st, tx = http("POST", f"{URL}/rest/v1/{table}", sbh({"Prefer": "return=minimal"}), c)
        if st >= 300: print(f"  ! insert {table} {st}: {tx[:200]}");
        else: n += len(c)
    return n
def sb_upsert(table, rows, on_conflict, chunk=500):
    n = 0
    for i in range(0, len(rows), chunk):
        c = rows[i:i+chunk]
        st, tx = http("POST", f"{URL}/rest/v1/{table}?on_conflict={on_conflict}",
                      sbh({"Prefer": "resolution=merge-duplicates,return=minimal"}), c)
        if st >= 300: print(f"  ! upsert {table} {st}: {tx[:200]}")
        else: n += len(c)
    return n

def tmdb(path):
    base = "https://api.themoviedb.org/3"
    if len(TMDB) > 40:
        url = base + path; hdr = {"Authorization": f"Bearer {TMDB}", "accept": "application/json"}
    else:
        sep = "&" if "?" in path else "?"; url = f"{base}{path}{sep}api_key={TMDB}"; hdr = {"accept": "application/json"}
    st, tx = http("GET", url, hdr)
    if st != 200: return None
    try: return json.loads(tx)
    except Exception: return None

def deacc(s): return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode("ascii")
def norm(s): return re.sub(r"[^a-z0-9]", "", deacc(s).lower())
ARTS = ("the ", "a ", "an ", "le ", "la ", "les ", "il ", "el ", "los ", "las ", "die ", "der ", "das ")
def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", deacc(s).lower()).strip("-"); return s[:80] or "film"
def norm_title(t):
    t = deacc((t or "").lower()).strip()
    m = re.match(r"^(.*),\s*(the|a|an|le|la|les|il|el|los|las|die|der|das)$", t)
    if m: t = f"{m.group(2)} {m.group(1)}"
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", t)).strip()
def strip_article(t):
    for a in ARTS:
        if t.startswith(a): return t[len(a):]
    return t

_cache = {}
if os.path.exists(CACHE):
    try: _cache = json.load(open(CACHE, encoding="utf-8"))
    except Exception: _cache = {}

def resolve_tmdb(title, year):
    key = f"{norm(title)}|{year}"
    if key in _cache: return _cache[key]
    nt = norm(title)
    res = []
    d = tmdb(f"/search/movie?query={urllib.parse.quote(title)}&year={year}&include_adult=false") or {}
    res = d.get("results", []) or []
    if not res:
        d = tmdb(f"/search/movie?query={urllib.parse.quote(title)}&include_adult=false") or {}
        res = d.get("results", []) or []
    if not res:
        alt = re.sub(r"^(the|a|an)\s+", "", title.strip(), flags=re.I)
        if norm(alt) != nt:
            d = tmdb(f"/search/movie?query={urllib.parse.quote(alt)}&include_adult=false") or {}
            res = d.get("results", []) or []
    out = None
    if res:
        def ry(c):
            rd = c.get("release_date") or ""
            return int(rd[:4]) if rd[:4].isdigit() else None
        exact = [c for c in res if norm(c.get("title")) == nt or norm(c.get("original_title")) == nt]
        pool = exact or res
        try: yr = int(year)
        except Exception: yr = None
        if yr:
            yexact = [c for c in pool if ry(c) is not None and abs(ry(c) - yr) <= 1]
            pool = yexact or pool
        c = sorted(pool, key=lambda x: x.get("popularity", 0), reverse=True)[0]
        out = {"tmdb_id": c.get("id"), "title": c.get("title") or c.get("original_title"),
               "year": ry(c), "poster_path": c.get("poster_path"),
               "overview": (c.get("overview") or "")[:1200] or None}
    _cache[key] = out
    if len(_cache) % 50 == 0: json.dump(_cache, open(CACHE, "w", encoding="utf-8"))
    time.sleep(0.05)
    return out

def main():
    masters = list(csv.DictReader(open(os.path.join(HANDOFF, "seeds/films_master.csv"), encoding="utf-8")))
    fl = list(csv.DictReader(open(os.path.join(HANDOFF, "mappings/film_lineage.csv"), encoding="utf-8")))
    fa = list(csv.DictReader(open(os.path.join(HANDOFF, "mappings/film_auteur.csv"), encoding="utf-8")))
    auteur_name = {a["slug"]: a["name"] for a in csv.DictReader(open(os.path.join(HANDOFF, "seeds/auteurs.csv"), encoding="utf-8"))}

    films = sb_get("films?select=id,title,year,tmdb_id,slug")
    by_ty, by_ty_strip, by_tmdb, slugs = {}, {}, {}, set()
    for f in films:
        nt = norm_title(f.get("title")); y = f.get("year")
        if nt and y is not None:
            by_ty.setdefault((nt, y), f["id"]); by_ty_strip.setdefault((strip_article(nt), y), f["id"])
        if f.get("tmdb_id"): by_tmdb[int(f["tmdb_id"])] = f["id"]
        if f.get("slug"): slugs.add(f["slug"])

    def existing_by_title(title, year):
        try: y = int(year)
        except Exception: return None
        nt = norm_title(title)
        for yy in (y, y-1, y+1):
            if (nt, yy) in by_ty: return by_ty[(nt, yy)]
        snt = strip_article(nt)
        for yy in (y, y-1, y+1):
            if (snt, yy) in by_ty_strip: return by_ty_strip[(snt, yy)]
        return None

    # candidates = films_master rows NOT already matched to an existing film by title
    cands = []
    for m in masters:
        if existing_by_title(m["film_title"], m["film_year"]) is None:
            cands.append(m)
    cands = cands[:LIMIT]
    print(f"[lineage-resolve] {'APPLY' if APPLY else 'DRY'} · masters {len(masters)} · already-in-DB-by-title {len(masters)-len([m for m in masters if existing_by_title(m['film_title'],m['film_year']) is None])} · to TMDB-resolve {len(cands)}")

    resolved = {}        # (norm_title, year:int) -> {"film_id":..,"new":bool,"stub":{...}|None}
    n_existing_missed = n_new = n_fail = 0
    new_stub_films = []
    for i, m in enumerate(cands):
        r = resolve_tmdb(m["film_title"], m["film_year"])
        if not r or not r.get("tmdb_id"):
            n_fail += 1; continue
        tid = int(r["tmdb_id"])
        try: y = int(m["film_year"])
        except Exception: y = r.get("year")
        kkey = (norm_title(m["film_title"]), int(m["film_year"]) if m["film_year"].isdigit() else (r.get("year") or 0))
        if tid in by_tmdb:
            resolved[kkey] = {"film_id": by_tmdb[tid], "new": False, "stub": None}; n_existing_missed += 1
        elif any(rr.get("film_id") and rr["stub"] and rr["stub"].get("tmdb_id") == tid for rr in resolved.values()):
            fid = next(rr["film_id"] for rr in resolved.values() if rr["stub"] and rr["stub"]["tmdb_id"] == tid)
            resolved[kkey] = {"film_id": fid, "new": True, "stub": None}
        else:
            fid = str(uuid.uuid4())
            base = f"{slugify(r['title'])}-{y}" if y else slugify(r["title"])
            slug = base if base not in slugs else f"{base}-{tid}"
            slugs.add(slug)
            dnames = [auteur_name.get(s) for s in (m.get("director_slugs") or "").split(";") if auteur_name.get(s)]
            stub = {"id": fid, "tmdb_id": tid, "title": r["title"], "slug": slug, "year": y,
                    "visible": False, "hold": True, "is_analyzed": False, "in_seed_catalog": False,
                    "poster_path": r.get("poster_path"), "overview": r.get("overview"),
                    "director": dnames[0] if dnames else None, "tmdb_extra": {}}
            new_stub_films.append(stub)
            by_tmdb[tid] = fid
            resolved[kkey] = {"film_id": fid, "new": True, "stub": stub}; n_new += 1
        if (i + 1) % 200 == 0:
            print(f"  …{i+1}/{len(cands)} · existing-missed {n_existing_missed} · new stub {n_new} · fail {n_fail}")
            json.dump(_cache, open(CACHE, "w", encoding="utf-8"))
    json.dump(_cache, open(CACHE, "w", encoding="utf-8"))

    # build memberships for resolved films (lists/editions/facet from DB)
    lists = sb_get("lineage_lists?select=id,slug,facet,has_editions")
    id_of = {l["slug"]: l["id"] for l in lists}
    facet_of = {l["slug"]: l["facet"] for l in lists}
    has_ed = {l["slug"]: l["has_editions"] for l in lists}
    for s in auteur_name: facet_of.setdefault(s, "auteur")

    def fid_for(title, year):
        try: y = int(year)
        except Exception: return None
        return (resolved.get((norm_title(title), y)) or {}).get("film_id")

    mem = []          # (film_id, list_slug, facet, edition_year, result, rank)
    for r in fl:
        fid = fid_for(r["film_title"], r["film_year"])
        if fid and r["list_slug"] in id_of:
            mem.append((fid, r["list_slug"], facet_of.get(r["list_slug"], "award"),
                        r.get("edition_year"), (r.get("result") or "").strip() or None,
                        (r.get("rank") or "").strip() or None))
    amem = []
    for r in fa:
        fid = fid_for(r["film_title"], r["film_year"])
        if fid and r["auteur_slug"] in id_of:
            amem.append((fid, r["auteur_slug"], (r.get("rep_type") or "").strip() or None))

    covered_new = set(x[0] for x in mem) | set(x[0] for x in amem)
    lines = ["# Lineage resolve — Phase 2 DRY\n",
             f"- films_master: {len(masters)} · TMDB-resolve candidates: {len(cands)}",
             f"- resolved → existing films we'd missed: **{n_existing_missed}**",
             f"- resolved → NEW stub films (invisible): **{n_new}**",
             f"- TMDB resolution failed: {n_fail}",
             f"- new memberships to add: film_lineage **{len(mem)}** + auteur **{len(amem)}** · films newly covered: **{len(covered_new)}**",
             "\n## Sample new stubs"]
    for s in new_stub_films[:25]:
        lines.append(f"- {s['title']} ({s['year']}) · tmdb {s['tmdb_id']} · /{s['slug']}")
    open(OUT, "w", encoding="utf-8").write("\n".join(lines))
    print(f"\n  existing-missed {n_existing_missed} · NEW stubs {n_new} · fail {n_fail}")
    print(f"  new memberships: fl {len(mem)} + auteur {len(amem)} · films newly covered {len(covered_new)}")
    print(f"  → {OUT}")

    if not APPLY:
        print("\nDRY — no writes. Re-run with --apply.")
        return

    # ---- APPLY ----
    print(f"\n[apply] creating {len(new_stub_films)} stub films ...")
    sb_insert("films", new_stub_films, chunk=200)

    # editions cache (+create missing for has_editions lists)
    ed_id = {(r["list_id"], r["year"]): r["id"] for r in sb_get("lineage_editions?select=id,list_id,year")}
    need = set()
    for fid, ls, facet, ey, res, rk in mem:
        if has_ed.get(ls) and ey and (id_of[ls], int(ey)) not in ed_id: need.add((ls, int(ey)))
    if need:
        sb_upsert("lineage_editions", [{"list_id": id_of[ls], "year": y, "slug": f"{ls}-{y}", "source": "wikipedia-enum"} for ls, y in need], "slug")
        ed_id = {(r["list_id"], r["year"]): r["id"] for r in sb_get("lineage_editions?select=id,list_id,year")}

    # dedup vs any existing memberships for these films
    fids = list(covered_new)
    seen = set()
    for i in range(0, len(fids), 80):
        chunk = fids[i:i+80]
        inl = "(" + ",".join(f'"{x}"' for x in chunk) + ")"
        for r in sb_get(f"film_lineage?select=film_id,list_id,edition_id&film_id=in.{inl}"):
            seen.add((r["film_id"], r["list_id"], r["edition_id"] or "0"))

    rows = []
    def row(fid, lid, eid, facet, res, rk, val):
        return {"film_id": fid, "list_id": lid, "edition_id": eid, "facet": facet,
                "result": res, "rank": rk, "value": val, "source": "lineage-resolve"}
    for fid, ls, facet, ey, res, rk in mem:
        lid = id_of[ls]; eid = ed_id.get((lid, int(ey))) if (has_ed.get(ls) and ey) else None
        k = (fid, lid, eid or "0")
        if k in seen: continue
        seen.add(k); rows.append(row(fid, lid, eid, facet, res, int(rk) if (rk and str(rk).isdigit()) else None, {}))
    for fid, aslug, rep in amem:
        lid = id_of[aslug]; k = (fid, lid, "0")
        if k in seen: continue
        seen.add(k); rows.append(row(fid, lid, None, "auteur", None, None, {"rep_type": rep} if rep else {}))
    n = sb_insert("film_lineage", rows)
    print(f"  wrote {n} new film_lineage rows")

    # recompute film_count + selectivity over ALL memberships
    import math
    nfilms = len(sb_get("films?select=id"))
    cnt = Counter(r["list_id"] for r in sb_get("film_lineage?select=list_id"))
    upd = []
    sl_of = {l["id"]: l["slug"] for l in lists}
    for lid, c in cnt.items():
        sl = sl_of.get(lid)
        if not sl: continue
        upd.append({"slug": sl, "film_count": c, "selectivity": round(math.log(nfilms / max(c, 1)), 4),
                    "facet": facet_of.get(sl, "award"), "label": sl})
    # NB: keep label unchanged — re-upsert label would overwrite; fetch real labels
    lab = {l2["slug"]: l2["label"] for l2 in sb_get("lineage_lists?select=slug,label")}
    for u in upd: u["label"] = lab.get(u["slug"], u["slug"])
    sb_upsert("lineage_lists", upd, "slug")
    print(f"  recomputed film_count/selectivity for {len(upd)} lists over {nfilms} films")
    print("\n✅ Phase 2 resolve done. Lineage universe complete (stubs invisible).")

if __name__ == "__main__":
    main()
