#!/usr/bin/env python3
"""Meta Take import (build step 2) — load the 567-film seed into the DB.

Reads data/seed/metatake_figures_takes_4662.csv and writes:
  films (upsert by tmdb_id), theory_families, theorists,
  figures (Target Object), takes (Application, raw Theory Concept on take).
meta_takes are NOT created here — the consolidation step (mt-consolidate.py)
births them from takes.raw_concept. No embeddings here (pure data load).
Idempotent guard: aborts if takes already present (use --force to override,
--fresh to delete figures/takes/meta_takes first).

Usage: python3 mt-import.py [--fresh] [--force] [--dry]
"""

import csv, os, re, sys, json, urllib.request, urllib.error, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY): print("Missing Supabase env"); sys.exit(1)
args=sys.argv[1:]; FRESH="--fresh" in args; FORCE="--force" in args; DRY="--dry" in args
CSV=os.path.join(ROOT,"data","seed","metatake_figures_takes_4662.csv")

def http(method,path,body=None,prefer=None,timeout=120):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}","Content-Type":"application/json"}
    if prefer: h["Prefer"]=prefer
    req=urllib.request.Request(f"{URL}/rest/v1/{path}",method=method,
        data=json.dumps(body).encode() if body is not None else None)
    for k,v in h.items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:500]

def slugify(s):
    s=re.sub(r"<[^>]+>","",s or "").lower()
    s=re.sub(r"[^a-z0-9]+","-",s).strip("-")
    return s[:80] or "x"

FORM_RE=re.compile(r"\b(scene|shot|sound|music|score|editing|edit|cut|camera|cinematograph|colou?r|narrative|structure|montage|title card|voice-?over|voice|dialect|speech|framing|mise-en-sc|lighting|sequence|style|aesthetic|animation|soundscape|pacing|tone|flashback|non-?linear|long take|close-?up)\b")
LOC_RE=re.compile(r"\b(landscape|cityscape|city|town|house|room|street|setting|place|location|land|island|building|prison|hotel|apartment|neighbou?rhood|region|country|desert|forest|sea|ocean|mountain|zone|terrain|geography|spatial|the\s+\w+\s+of\s+\w+\s+(city|town))\b")
OBJ_RE=re.compile(r"\b(photograph|object|motif|symbol|prop|artifact|costume|mask|mirror|food|car|gun|weapon|knife|letter|book|painting|machine|device|clothing|recurring\s+\w+\s+of)\b")
def kind_of(label, char_names):
    l=(label or "").lower()
    if FORM_RE.search(l): return "form"
    if LOC_RE.search(l): return "location"
    if OBJ_RE.search(l): return "object"
    if "character of" in l or "the figure of" in l or "protagonist" in l: return "character"
    if char_names:
        names=[n.strip().lower() for n in char_names.split(",") if n.strip()]
        if l in names: return "character"
    return "trope"

def chunks(xs,n):
    for i in range(0,len(xs),n): yield xs[i:i+n]

def main():
    rows=[r for r in csv.DictReader(open(CSV,encoding="utf-8"))]
    rows=[r for r in rows if (r.get("Target Object") or "").strip()]  # 위생: 빈 Target 스킵
    print(f"[import] {len(rows)} rows (blank Target Object skipped){' [DRY]' if DRY else ''}")

    # guard
    st,tx=http("GET","takes?select=id&limit=1")
    existing = st==200 and len(json.loads(tx))>0
    if existing and not (FORCE or FRESH):
        print("[import] takes already present — abort (use --force or --fresh)"); sys.exit(1)
    if FRESH and not DRY:
        for t in ("takes","figures","meta_takes"):
            http("DELETE",f"{t}?id=not.is.null",prefer="return=minimal")
        print("[import] --fresh: cleared takes/figures/meta_takes")

    # 1) theory_families + theorists (upsert by slug)
    fams={}; thes={}
    for r in rows:
        tn=(r.get("Theory Name") or "").strip()
        th=(r.get("Theorist Name") or "").strip()
        if tn: fams.setdefault(slugify(tn), tn)
        if th: thes.setdefault(slugify(th), th)
    if not DRY:
        http("POST","theory_families?on_conflict=slug",
             [{"slug":s,"name":n} for s,n in fams.items()],
             prefer="resolution=ignore-duplicates,return=minimal")
        http("POST","theorists?on_conflict=slug",
             [{"slug":s,"name":n} for s,n in thes.items()],
             prefer="resolution=ignore-duplicates,return=minimal")
    # fetch id maps
    fam_id={}; the_id={}
    if not DRY:
        st,tx=http("GET","theory_families?select=id,slug&limit=5000"); fam_id={r["slug"]:r["id"] for r in json.loads(tx)}
        st,tx=http("GET","theorists?select=id,slug&limit=5000"); the_id={r["slug"]:r["id"] for r in json.loads(tx)}
    print(f"[import] theory_families {len(fams)} | theorists {len(thes)}")

    # 2) films upsert (by tmdb_id) — from seed (tmdb_id,title,director,year)
    films={}
    for r in rows:
        tid=(r.get("Film_TMDB_ID") or "").strip()
        if not tid: continue
        films.setdefault(tid, {"tmdb_id":int(tid),"title":(r.get("Film_Title") or "").strip(),
            "director":(r.get("Film_Director_Name") or "").strip(),
            "year":int(r["Film_year"]) if (r.get("Film_year") or "").strip().isdigit() else None})
    film_rows=[]
    for tid,f in films.items():
        film_rows.append({"tmdb_id":f["tmdb_id"],"title":f["title"],"year":f["year"],
            "director":f["director"] or None,"director_slug":slugify(f["director"]) if f["director"] else None,
            "slug":(slugify(f["title"])+("-"+str(f["year"]) if f["year"] else ""))[:120]})
    if not DRY:
        for c in chunks(film_rows,200):
            http("POST","films?on_conflict=tmdb_id",c,prefer="resolution=ignore-duplicates,return=minimal")
    # map tmdb_id -> film uuid
    film_uuid={}
    if not DRY:
        st,tx=http("GET","films?select=id,tmdb_id&limit=5000")
        film_uuid={str(r["tmdb_id"]):r["id"] for r in json.loads(tx) if r["tmdb_id"] is not None}
    print(f"[import] films upserted: {len(film_rows)} | mapped uuids: {len(film_uuid)}")

    # 3) figures + takes
    fig_rows=[]; meta=[]  # meta holds (row, fig_index) to build takes after we get fig ids
    for r in rows:
        tid=(r.get("Film_TMDB_ID") or "").strip()
        fuid=film_uuid.get(tid)
        if not fuid: continue
        label=re.sub(r"<[^>]+>","",(r.get("Target Object") or "").strip())
        fig_rows.append({
            "film_id":fuid,"kind":kind_of(label, r.get("Character_Names")),
            "label":label[:300],
            "character_names":(r.get("Character_Names") or "").strip() or None,
            "image_query":(r.get("Image Search Query") or "").strip() or None,
            "youtube_query":(r.get("YouTube Search Keyword") or "").strip() or None,
            "source":"seed","generated_by":"metatake-seed","status":"approved",
        })
        meta.append(r)
    if DRY:
        from collections import Counter
        print("[import] kind 분포:", dict(Counter(f["kind"] for f in fig_rows)))
        print(f"[import] (dry) would insert {len(fig_rows)} figures + {len(fig_rows)} takes"); return

    # insert figures + takes interleaved per chunk. figure↔take alignment is
    # only relied on WITHIN one INSERT…RETURNING (PostgREST returns input order).
    nfig=ntake=0
    for fc, mc in zip(chunks(fig_rows,200), chunks(meta,200)):
        st,tx=http("POST","figures",fc,prefer="return=representation")
        if st>=300: print(f"[import] figure insert {st}: {tx[:200]}"); sys.exit(1)
        ids=[x["id"] for x in json.loads(tx)]
        nfig+=len(ids)
        take_rows=[]
        for fid,r in zip(ids,mc):
            th=slugify((r.get("Theorist Name") or "").strip()) if (r.get("Theorist Name") or "").strip() else None
            take_rows.append({
                "figure_id":fid,"meta_take_id":None,
                "rationale":(r.get("Application") or "").strip() or None,
                "rationale_guide":(r.get("Application_Guide") or "").strip() or None,
                "raw_concept":re.sub(r"<[^>]+>","",(r.get("Theory Concept") or "").strip()) or None,
                "source_citation":(r.get("Source") or "").strip() or None,
                "source_url":(r.get("Source_URL") or "").strip() or None,
                "source_year":int(r["Source_year"]) if (r.get("Source_year") or "").strip().isdigit() else None,
                "theorist_id":the_id.get(th),
            })
        st,tx=http("POST","takes",take_rows,prefer="return=minimal")
        if st>=300: print(f"[import] take insert {st}: {tx[:200]}"); sys.exit(1)
        ntake+=len(take_rows)
    print(f"[import] figures inserted: {nfig} | takes inserted: {ntake}")
    print(f"[import] done. Next: mt-consolidate.py to birth meta takes from raw_concept.")

if __name__=="__main__": main()
