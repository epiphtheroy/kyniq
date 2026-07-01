#!/usr/bin/env python3
"""Catalog (taxonomy) loader — v0.

Parses Element/Object_Catalog.xlsx + Element/Character_Catalog.xlsx into the
`taxonomy_nodes` controlled vocabulary, embeds each node (text-embedding-3-small,
1536-dim, same space as figures), and upserts. Location/Theory are excluded
(Theory reuses the existing concept canon; Location comes later).

Node kinds produced:
  object_type      (23)   from Object 'Type schema'
  function         (7)    derived from Object Primary Function I–VII
  object           (~583 active + ~? proposed) from 'Objects (props)' / 'Proposed gaps'
  char_identity    (~903) from Axis1
  char_function    (~57)  from Axis2
  char_complex     (~146) from Axis3 (label = Designation primary)
  char_archetype   (~16)  from 'Trope = Role × Complex' (named, e.g. Femme Fatale)
  theme_cluster    (~18)  from Theme 'Cluster schema'
  theme            (~536) from Theme 'UCN (final)'
  location_category(7)    from Place 'Places' Category (I–VII)
  location_group   (38)   from Place 'Places' Archetype group (1. The Metropolis …)
  location         (~532) from Place 'Places' (named place-archetype, e.g. The Noir City)

NOT imported (route elsewhere): Object '→ Theme layer' (abstractions) + 'Craft devices' (methods).

Usage:
  python3 catalog-load.py --dry         # parse + summary, no DB / no OpenAI
  python3 catalog-load.py --apply        # embed + load (wipes taxonomy_nodes first)
"""
import os, sys, re, json, uuid, time, urllib.request, urllib.error
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
ELEM = os.path.join(ROOT, "Element")
OBJ_XLSX = os.path.join(ELEM, "Object_Catalog.xlsx")
CHR_XLSX = os.path.join(ELEM, "Character_Catalog.xlsx")
THM_XLSX = os.path.join(ELEM, "Theme catalog.xlsx")
PLC_XLSX = os.path.join(ELEM, "Place_Catalog.xlsx")

def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))

ARGS = sys.argv[1:]
DRY = "--apply" not in ARGS
MODEL = "text-embedding-3-small"

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
OPENAI = os.environ.get("OPENAI_API_KEY")

# ---------- helpers ----------
def s(v):
    if v is None: return ""
    if isinstance(v, float) and pd.isna(v): return ""
    return str(v).strip()

def nz(v):
    t = s(v); return t if t else None

_slugs = {}
def slug(kind, label):
    base = re.sub(r"^(the|a|an)\s+", "", label.strip().lower())
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-") or "x"
    base = base[:60].strip("-")
    key = (kind, base); n = _slugs.get(key, 0) + 1; _slugs[key] = n
    return base if n == 1 else f"{base}-{n}"

def split_code(text):
    """'T02 Jewelry & Insignia' -> ('T02','Jewelry & Insignia'); 'I Aspiration & Desire' -> ('I','Aspiration & Desire')."""
    t = s(text)
    m = re.match(r"^([A-Z]{1,3}\d{1,3}|[IVX]+)\s+(.*)$", t)
    if m: return m.group(1), m.group(2).strip()
    return None, t

def http(method, url, headers=None, body=None, timeout=180):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data); req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:600]

def embed_batch(texts):
    st, body = http("POST", "https://api.openai.com/v1/embeddings",
                    {"Authorization": f"Bearer {OPENAI}"}, {"model": MODEL, "input": texts})
    if st != 200: raise SystemExit(f"embed error {st}: {body}")
    return [d["embedding"] for d in json.loads(body)["data"]]

# ---------- parse ----------
def parse_objects():
    types, functions, objects = [], [], []
    fseen = {}
    xl = pd.ExcelFile(OBJ_XLSX)
    # types
    for _, r in xl.parse("Type schema").iterrows():
        code, lab = nz(r.get("Code")), s(r.get("Object Type"))
        if not lab: continue
        types.append({"id": str(uuid.uuid4()), "kind": "object_type", "label": lab, "code": code,
                      "slug": slug("object_type", lab), "meta": {"n_props": (int(r["#props"]) if not pd.isna(r.get("#props")) else None)}, "source": "object_catalog"})
    type_by_code = {t["code"]: t["id"] for t in types if t["code"]}
    # objects (kept) + proposed gaps
    def add_obj(label, type_text, prim, sec, definition, status, src):
        label = s(label)
        if not label or label.startswith("—"): return
        tcode, _ = split_code(type_text); pcode, plabel = split_code(prim)
        if pcode and pcode not in fseen:
            fseen[pcode] = plabel
            functions.append({"id": str(uuid.uuid4()), "kind": "function", "label": plabel, "code": pcode,
                              "slug": slug("function", plabel), "meta": {}, "source": "object_catalog"})
        objects.append({"id": str(uuid.uuid4()), "kind": "object", "label": label,
                        "slug": slug("object", label), "code": None, "definition": nz(definition),
                        "parent_id": type_by_code.get(tcode), "status": status,
                        "meta": {"object_type": s(type_text) or None, "primary_function": nz(prim),
                                 "secondary_function": nz(sec)}, "source": src})
    for _, r in xl.parse("Objects (props)").iterrows():
        add_obj(r.get("Object"), r.get("Object Type"), r.get("Primary Function"),
                r.get("Secondary (suggested)"), r.get("Playwright's-Tool Description"), "active", "object_catalog")
    for _, r in xl.parse("Proposed gaps").iterrows():
        add_obj(r.get("Proposed Object"), r.get("Type"), r.get("Function"), None,
                r.get("Playwright's-Tool note"), "proposed", "proposed_gap")
    return types, functions, objects

def parse_characters():
    ident, func, complx, arche = [], [], [], []
    xl = pd.ExcelFile(CHR_XLSX)
    for _, r in xl.parse("Axis1 — Identity").iterrows():
        lab = s(r.get("Role (지칭어)"))
        if not lab: continue
        ident.append({"id": str(uuid.uuid4()), "kind": "char_identity", "label": lab, "slug": slug("char_identity", lab),
                      "meta": {"facet": nz(r.get("Facet (category)")), "subcategory": nz(r.get("Subcategory"))}, "source": "character_catalog"})
    for _, r in xl.parse("Axis2 — Narrative Function").iterrows():
        lab = s(r.get("Narrative Function"))
        if not lab: continue
        func.append({"id": str(uuid.uuid4()), "kind": "char_function", "label": lab, "slug": slug("char_function", lab),
                     "meta": {"note": nz(r.get("Note"))}, "source": "character_catalog"})
    for _, r in xl.parse("Axis3 — Complex").iterrows():
        lab = s(r.get("Designation (primary)"))
        if not lab: continue
        complx.append({"id": str(uuid.uuid4()), "kind": "char_complex", "label": lab, "slug": slug("char_complex", lab),
                       "code": (str(int(r["#"])) if not pd.isna(r.get("#")) else None), "definition": nz(r.get("Definition")),
                       "meta": {"complex": nz(r.get("Complex (X vs Y)")), "area": nz(r.get("Area")),
                                "object_of_conflict": nz(r.get("Object of conflict")), "designation_alt": nz(r.get("Designation (alt)"))},
                       "source": "character_catalog"})
    for _, r in xl.parse("Trope = Role × Complex").iterrows():
        lab = s(r.get("Trope / Archetype")); role = s(r.get("Role (Axis1/2)"))
        if not lab or not role or lab.startswith("▶"): continue
        arche.append({"id": str(uuid.uuid4()), "kind": "char_archetype", "label": lab, "slug": slug("char_archetype", lab),
                      "definition": nz(r.get("What the pairing means")),
                      "meta": {"role": role, "complex": nz(r.get("Complex (Axis3)"))}, "source": "character_catalog"})
    return ident, func, complx, arche

def parse_themes():
    clusters, themes = [], []
    xl = pd.ExcelFile(THM_XLSX)
    for _, r in xl.parse("Cluster schema").iterrows():
        code, fam = nz(r.get("Cluster")), s(r.get("Theme family"))
        if not code or not fam: continue
        clusters.append({"id": str(uuid.uuid4()), "kind": "theme_cluster", "label": fam, "code": code,
                         "slug": slug("theme_cluster", fam), "meta": {}, "source": "theme_catalog"})
    cl_by_code = {c["code"]: c["id"] for c in clusters}
    for _, r in xl.parse("UCN (final)").iterrows():
        name = s(r.get("Canonical_Name"))
        if not name: continue
        ccode, clabel = split_code(r.get("Cluster")); fcode, flabel = split_code(r.get("Facet"))
        themes.append({"id": str(uuid.uuid4()), "kind": "theme", "label": name, "slug": slug("theme", name),
                       "code": nz(r.get("UCN_id")), "definition": nz(r.get("Definition")),
                       "parent_id": cl_by_code.get(ccode), "status": "active",
                       "meta": {"facet": fcode, "facet_label": flabel, "cluster": ccode, "cluster_label": clabel,
                                "aliases": nz(r.get("Aliases (merged in)")), "notes": nz(r.get("Notes")),
                                "status_src": nz(r.get("Status"))}, "source": "theme_catalog"})
    return clusters, themes

def parse_places():
    """Place_Catalog 'Places' sheet → 3-tier: location_category (7) → location_group (38) → location (532)."""
    cats, groups, places = [], [], []
    cat_by, grp_by = {}, {}
    if not os.path.exists(PLC_XLSX):
        return cats, groups, places
    df = pd.ExcelFile(PLC_XLSX).parse("Places")
    for _, r in df.iterrows():
        catraw, grpraw, place = s(r.get("Category")), s(r.get("Archetype")), s(r.get("Place"))
        if not place:
            continue
        cid = cat_by.get(catraw)
        if cid is None and catraw:
            mc = re.match(r"^([IVXLC]+)\.\s*(.*)$", catraw)
            ccode, clabel = (mc.group(1), mc.group(2).strip()) if mc else (None, catraw)
            node = {"id": str(uuid.uuid4()), "kind": "location_category", "label": clabel, "code": ccode,
                    "slug": slug("location_category", clabel), "meta": {"raw": catraw}, "source": "place_catalog"}
            cats.append(node); cid = node["id"]; cat_by[catraw] = cid
        gid = grp_by.get(grpraw)
        if gid is None and grpraw:
            mg = re.match(r"^(\d+)\.\s*(.*)$", grpraw)
            gcode, glabel = (mg.group(1), mg.group(2).strip()) if mg else (None, grpraw)
            node = {"id": str(uuid.uuid4()), "kind": "location_group", "label": glabel, "code": gcode,
                    "slug": slug("location_group", glabel), "parent_id": cid, "meta": {"raw": grpraw},
                    "source": "place_catalog"}
            groups.append(node); gid = node["id"]; grp_by[grpraw] = gid
        places.append({"id": str(uuid.uuid4()), "kind": "location", "label": place,
                       "slug": slug("location", place), "code": None, "definition": nz(r.get("Description")),
                       "parent_id": gid, "status": "active",
                       "meta": {"category": catraw or None, "group": grpraw or None,
                                "status_src": s(r.get("Status")) or "original"}, "source": "place_catalog"})
    return cats, groups, places

def basis(n):
    parts = [n["label"]]
    if n.get("definition"): parts.append(n["definition"])
    m = n.get("meta") or {}
    for k in ("primary_function", "object_type", "complex", "facet", "area", "group"):
        if m.get(k): parts.append(str(m[k]))
    return ". ".join(parts)[:1200]

# ---------- run ----------
def main():
    types, functions, objects = parse_objects()
    ident, cfunc, complx, arche = parse_characters()
    clusters, themes = parse_themes()
    cats, groups, places = parse_places()
    allnodes = (types + functions + objects + ident + cfunc + complx + arche
                + clusters + themes + cats + groups + places)
    counts = {}
    for n in allnodes: counts[n["kind"]] = counts.get(n["kind"], 0) + 1
    print("== Catalog load ==", "DRY" if DRY else "APPLY")
    for k, v in counts.items(): print(f"  {k:16} {v}")
    print(f"  {'TOTAL':16} {len(allnodes)}")
    print("\nSamples:")
    for kind in ("object", "char_identity", "char_complex", "char_archetype", "theme", "location_group", "location"):
        ex = next((n for n in allnodes if n["kind"] == kind), None)
        if ex: print(f"  [{kind}] {ex['label']}  ::  {(ex.get('definition') or json.dumps(ex['meta'], ensure_ascii=False))[:120]}")

    if DRY:
        print("\n(DRY) nothing written. Re-run with --apply.")
        return

    if not (URL and KEY and OPENAI):
        raise SystemExit("Missing env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + OPENAI_API_KEY")

    # wipe (fresh load) — figure_taxonomy then nodes
    print("\nwiping taxonomy_nodes + figure_taxonomy …")
    http("DELETE", f"{URL}/rest/v1/figure_taxonomy?figure_id=not.is.null", {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Prefer": "return=minimal"})
    http("DELETE", f"{URL}/rest/v1/taxonomy_nodes?id=not.is.null", {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Prefer": "return=minimal"})

    # embed (batched)
    print("embedding …")
    for i in range(0, len(allnodes), 256):
        chunk = allnodes[i:i + 256]
        vecs = embed_batch([basis(n) for n in chunk])
        for n, v in zip(chunk, vecs): n["embedding"] = "[" + ",".join(f"{x:.6f}" for x in v) + "]"
        print(f"  embedded {min(i+256,len(allnodes))}/{len(allnodes)}"); time.sleep(0.2)

    # insert (batched)
    print("inserting …")
    def row(n):
        return {"id": n["id"], "kind": n["kind"], "label": n["label"], "slug": n["slug"],
                "code": n.get("code"), "definition": n.get("definition"), "parent_id": n.get("parent_id"),
                "meta": n.get("meta") or {}, "embedding": n.get("embedding"),
                "status": n.get("status", "active"), "source": n.get("source")}
    ok = 0
    for i in range(0, len(allnodes), 150):
        chunk = [row(n) for n in allnodes[i:i + 150]]
        st, body = http("POST", f"{URL}/rest/v1/taxonomy_nodes",
                        {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Prefer": "return=minimal"}, chunk)
        if st not in (200, 201): raise SystemExit(f"insert error {st}: {body}")
        ok += len(chunk); print(f"  inserted {ok}/{len(allnodes)}")
    print(f"\n✅ loaded {ok} taxonomy nodes.")

if __name__ == "__main__":
    main()
