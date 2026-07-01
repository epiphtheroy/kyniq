#!/usr/bin/env python3
"""lineage-ingest — Phase 1 of the Lineage layer.

Loads the handoff CSV package into the DB and attaches film_lineage memberships to the films we
ALREADY have (existing-films-only; non-matching titles are skipped, NOT stubbed — that's Phase 2).

Order:
  1) lineage_lists.csv (239)  → upsert lineage_lists (ON CONFLICT slug); 2nd pass parent_slug→parent_id
  2) auteurs.csv (160)        → upsert lineage_lists facet='auteur'  (external_ref={wikidata,birth_year,group})
  3) lineage_editions.csv(24) → upsert preseed editions (S&S years, TSPDT 2026, AFI ... with rank_max)
  4) film_lineage.csv(10,238) → resolve film_title+film_year to EXISTING films; create editions on the
                                fly when the list has_editions; write film_lineage (won/listed + rank)
  5) film_auteur.csv(407)     → resolve film; write film_lineage facet='auteur' value={rep_type}
  6) recompute lineage_lists.film_count + selectivity (IDF)

DRY by default: resolves everything in memory and prints a coverage report (no writes).
--apply: writes. Idempotent — replaces film_lineage wholesale (Phase 1 owns the table).

Usage:
  python3 lineage-ingest.py                       # DRY → worker/lineage-ingest-dry.md
  python3 lineage-ingest.py --apply
"""
import os, sys, json, re, csv, unicodedata, urllib.request, urllib.error
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
args = sys.argv[1:]
APPLY = "--apply" in args
OUT = os.path.join(HERE, "lineage-ingest-dry.md")
if not (URL and KEY): sys.exit("Missing SUPABASE env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)")
csv.field_size_limit(10_000_000)

def http(method, url, headers=None, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    if body is not None: req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:400]
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
        if st >= 300: print(f"  ! insert {table} {st}: {tx[:200]}")
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
def sb_delete_all(table):
    http("DELETE", f"{URL}/rest/v1/{table}?id=not.is.null", sbh({"Prefer": "return=minimal"}))

# ---------- title normalization ----------
ARTICLES = ("the ", "a ", "an ", "le ", "la ", "les ", "il ", "el ", "los ", "las ", "die ", "der ", "das ")
def deacc(s): return "".join(c for c in unicodedata.normalize("NFKD", s or "") if not unicodedata.combining(c))
def norm(t):
    t = deacc((t or "").lower()).strip()
    # "Godfather, The" -> "the godfather"
    m = re.match(r"^(.*),\s*(the|a|an|le|la|les|il|el|los|las|die|der|das)$", t)
    if m: t = f"{m.group(2)} {m.group(1)}"
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t
def strip_article(t):
    for a in ARTICLES:
        if t.startswith(a): return t[len(a):]
    return t

def read_csv(rel):
    p = os.path.join(HANDOFF, rel)
    with open(p, encoding="utf-8") as f:
        return list(csv.DictReader(f))

# ---------- build film resolver from existing DB films ----------
def build_resolver():
    films = sb_get("films?select=id,title,year")
    by_ty = {}            # (norm,year) -> id
    by_ty_strip = {}      # (strip_article(norm),year) -> id
    for f in films:
        nt = norm(f.get("title")); y = f.get("year")
        if not nt or y is None: continue
        by_ty.setdefault((nt, y), f["id"])
        by_ty_strip.setdefault((strip_article(nt), y), f["id"])
    return films, by_ty, by_ty_strip

def resolve(title, year, by_ty, by_ty_strip):
    try: y = int(year)
    except Exception: return None
    nt = norm(title)
    for yy in (y, y-1, y+1):                    # film_year vs award off-by-one tolerance
        if (nt, yy) in by_ty: return by_ty[(nt, yy)]
    snt = strip_article(nt)
    for yy in (y, y-1, y+1):
        if (snt, yy) in by_ty_strip: return by_ty_strip[(snt, yy)]
    return None

def main():
    lists = read_csv("seeds/lineage_lists.csv")
    auteurs = read_csv("seeds/auteurs.csv")
    editions = read_csv("seeds/lineage_editions.csv")
    fl = read_csv("mappings/film_lineage.csv")
    fa = read_csv("mappings/film_auteur.csv")

    # facet + has_editions lookup by slug (lists + auteurs)
    facet_of = {r["slug"]: r["facet"] for r in lists}
    has_ed = {r["slug"]: (r.get("has_editions") or "").strip().lower() == "true" for r in lists}
    for a in auteurs:
        facet_of[a["slug"]] = "auteur"; has_ed[a["slug"]] = False

    print(f"[lineage-ingest] {'APPLY' if APPLY else 'DRY'}")
    print(f"  vocab: lists {len(lists)} · auteurs {len(auteurs)} · editions(preseed) {len(editions)}")
    print(f"  memberships: film_lineage {len(fl)} · film_auteur {len(fa)}")

    films, by_ty, by_ty_strip = build_resolver()
    print(f"  existing films in DB: {len(films)}")

    # resolve film_lineage to existing films
    matched = []      # (film_id, list_slug, facet, edition_year, result, rank)
    unmatched = []
    for r in fl:
        fid = resolve(r["film_title"], r["film_year"], by_ty, by_ty_strip)
        if not fid: unmatched.append((r["list_slug"], r["film_title"], r["film_year"])); continue
        matched.append((fid, r["list_slug"], facet_of.get(r["list_slug"], "award"),
                        r.get("edition_year"), (r.get("result") or "").strip() or None,
                        (r.get("rank") or "").strip() or None))
    # resolve film_auteur
    a_matched = []; a_unmatched = []
    for r in fa:
        fid = resolve(r["film_title"], r["film_year"], by_ty, by_ty_strip)
        if not fid: a_unmatched.append((r["auteur_slug"], r["film_title"], r["film_year"])); continue
        a_matched.append((fid, r["auteur_slug"], r.get("rep_type")))

    covered = set(m[0] for m in matched) | set(m[0] for m in a_matched)
    by_facet = Counter(m[2] for m in matched)
    by_list = Counter(m[1] for m in matched)

    # ---- report ----
    lines = ["# Lineage ingest — DRY (existing films only)\n"]
    lines.append(f"- existing films: **{len(films)}** · covered by ≥1 lineage: **{len(covered)}** ({len(covered)*100//max(1,len(films))}%)")
    lines.append(f"- film_lineage memberships matched: **{len(matched)}** / {len(fl)} · unmatched(skipped): {len(unmatched)}")
    lines.append(f"- film_auteur matched: **{len(a_matched)}** / {len(fa)} · unmatched: {len(a_unmatched)}")
    lines.append(f"- memberships by facet: " + ", ".join(f"{k} {v}" for k, v in by_facet.most_common()))
    lines.append("\n## Top 20 lists by covered films")
    label_of = {r["slug"]: r["label"] for r in lists}
    for slug, c in by_list.most_common(20):
        lines.append(f"- {label_of.get(slug, slug)} — {c}")
    lines.append("\n## Sample unmatched (skipped, would be Phase 2 stubs)")
    for slug, t, y in unmatched[:25]:
        lines.append(f"- [{slug}] {t} ({y})")
    open(OUT, "w", encoding="utf-8").write("\n".join(lines))
    print(f"\n  covered {len(covered)}/{len(films)} films · matched {len(matched)} memberships ({dict(by_facet)})")
    print(f"  film_auteur matched {len(a_matched)}/{len(fa)} · unmatched fl {len(unmatched)}")
    print(f"  → {OUT}")

    if not APPLY:
        print("\nDRY — no writes. Re-run with --apply.")
        return

    # ---------- APPLY ----------
    print("\n[apply] writing vocab ...")
    # 1) lineage_lists (no parent yet)
    def jload(s):
        try: return json.loads(s) if s and s.strip() else {}
        except Exception: return {}
    list_rows = []
    for r in lists:
        list_rows.append({
            "facet": r["facet"], "slug": r["slug"], "label": r["label"],
            "has_editions": (r.get("has_editions") or "").strip().lower() == "true",
            "tier": (r.get("tier") or "").strip() or None,
            "strategic_tier": (r.get("strategic_tier") or "").strip() or None,
            "authority_weight": float(r["authority_weight"]) if (r.get("authority_weight") or "").strip() else None,
            "external_ref": jload(r.get("external_ref")), "source": (r.get("source") or "").strip() or None,
            "description": (r.get("description") or "").strip() or None,
            "country": (r.get("country") or "").strip() or None})
    sb_upsert("lineage_lists", list_rows, "slug")
    # auteur lineage rows
    au_rows = []
    for a in auteurs:
        au_rows.append({"facet": "auteur", "slug": a["slug"], "label": a["name"],
                        "has_editions": False,
                        "authority_weight": float(a["authority_weight"]) if (a.get("authority_weight") or "").strip() else None,
                        "country": (a.get("country") or "").strip() or None,
                        "external_ref": {"wikidata": a.get("wikidata"), "birth_year": a.get("birth_year"),
                                         "group": a.get("group"), "also_country": a.get("also_country") or None},
                        "source": (a.get("source") or "").strip() or None})
    sb_upsert("lineage_lists", au_rows, "slug")
    # id map
    id_of = {r["slug"]: r["id"] for r in sb_get("lineage_lists?select=id,slug")}
    # 2nd pass parent
    par = []
    for r in lists:
        ps = (r.get("parent_slug") or "").strip()
        if ps and ps in id_of and r["slug"] in id_of:
            par.append({"slug": r["slug"], "parent_id": id_of[ps], "facet": r["facet"], "label": r["label"]})
    if par: sb_upsert("lineage_lists", par, "slug")

    # 2) preseed editions
    ed_rows = []
    for e in editions:
        ls = e["list_slug"]
        if ls not in id_of: continue
        ed_rows.append({"list_id": id_of[ls], "year": int(e["year"]), "slug": e["slug"],
                        "edition_label": (e.get("edition_label") or "").strip() or None,
                        "rank_max": int(e["rank_max"]) if (e.get("rank_max") or "").strip() else None,
                        "source": (e.get("source") or "").strip() or None})
    if ed_rows: sb_upsert("lineage_editions", ed_rows, "slug")
    ed_id = {(r["list_id"], r["year"]): r["id"] for r in sb_get("lineage_editions?select=id,list_id,year")}

    # create on-the-fly editions for has_editions lists referenced in film_lineage
    need = set()
    for fid, ls, facet, ey, res, rk in matched:
        if has_ed.get(ls) and ls in id_of and ey and (id_of[ls], int(ey)) not in ed_id:
            need.add((ls, int(ey)))
    new_ed = [{"list_id": id_of[ls], "year": y, "slug": f"{ls}-{y}", "source": "wikipedia-enum"} for ls, y in need]
    if new_ed:
        sb_upsert("lineage_editions", new_ed, "slug")
        ed_id = {(r["list_id"], r["year"]): r["id"] for r in sb_get("lineage_editions?select=id,list_id,year")}

    # 3) film_lineage rows (replace wholesale)
    print("[apply] replacing film_lineage ...")
    sb_delete_all("film_lineage")
    seen = set(); rows = []
    def row(fid, lid, eid, facet, res, rk, val):
        return {"film_id": fid, "list_id": lid, "edition_id": eid, "facet": facet,
                "result": res, "rank": rk, "value": val, "source": "lineage-ingest"}
    for fid, ls, facet, ey, res, rk in matched:
        if ls not in id_of: continue
        lid = id_of[ls]
        eid = ed_id.get((lid, int(ey))) if (has_ed.get(ls) and ey) else None
        key = (fid, lid, eid or "0")
        if key in seen: continue
        seen.add(key)
        rows.append(row(fid, lid, eid, facet, res, int(rk) if (rk and str(rk).isdigit()) else None, {}))
    for fid, aslug, rep in a_matched:
        if aslug not in id_of: continue
        lid = id_of[aslug]; key = (fid, lid, "0")
        if key in seen: continue
        seen.add(key)
        rows.append(row(fid, lid, None, "auteur", None, None, {"rep_type": rep} if rep else {}))
    n = sb_insert("film_lineage", rows)
    print(f"  wrote {n} film_lineage rows")

    # 4) recompute film_count + selectivity (IDF)
    nfilms = len(films)
    cnt = Counter(m[1] for m in matched) + Counter(a[1] for a in a_matched)
    import math
    upd = []
    for slug, c in cnt.items():
        if slug not in id_of: continue
        upd.append({"slug": slug, "film_count": c, "selectivity": round(math.log(nfilms / max(c, 1)), 4),
                    "facet": facet_of.get(slug, "award"), "label": next((x["label"] for x in lists+[{'slug':a['slug'],'label':a['name']} for a in auteurs] if x["slug"]==slug), slug)})
    sb_upsert("lineage_lists", upd, "slug")
    print(f"  recomputed film_count/selectivity for {len(upd)} lists")
    print("\n✅ Lineage Phase 1 ingest done. Build the film tab next.")

if __name__ == "__main__":
    main()
