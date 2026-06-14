#!/usr/bin/env python3
"""TMDB enrichment fetch (migration 0015) — film metadata + media + directors.

Per film (by tmdb_id): /movie + /credits + /release_dates + /videos + /images.
  - UPDATE films: backdrop_path, tagline, runtime, release_date, certification,
    tmdb_extra (curated cast/writers/country/lang/vote/collection — NOT a raw dump).
  - MEDIA rows: top backdrops (image/tmdb) + official trailer (video/youtube).
Per unique director: /person/{id} → directors row (profile, bio) + profile media.

Images/videos live in the existing `media` table (reused). Idempotent: deletes
this entity's prior tmdb/youtube media then re-inserts; UPSERTs films/directors.

SAFETY: default DRY (fetches + prints, NO DB writes). --persist to write (needs 0015).
Usage:
  python3 tmdb-fetch.py --film forrest-gump-1994 [--film the-power-of-the-dog-2021]
  python3 tmdb-fetch.py --film forrest-gump-1994 --persist
  python3 tmdb-fetch.py --persist            # all films with a tmdb_id
"""
import os, sys, json, re, time, urllib.request, urllib.error, urllib.parse
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p,encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
TMDB=os.environ.get("TMDB_READ_TOKEN")
if not (URL and KEY and TMDB): print("Missing env (SUPABASE url/service key + TMDB_READ_TOKEN)"); sys.exit(1)
args=sys.argv[1:]
PERSIST="--persist" in args
LIMIT=int(args[args.index("--limit")+1]) if "--limit" in args else 100000
FILMS=[args[i+1] for i,a in enumerate(args) if a=="--film"]
IMG="https://image.tmdb.org/t/p"

def http(method,url,headers=None,body=None,timeout=60):
    req=urllib.request.Request(url,method=method,data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type","application/json")
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
def tmdb(path):
    base="https://api.themoviedb.org/3"
    if len(TMDB)>40:  # v4 read access token
        url=base+path; headers={"Authorization":f"Bearer {TMDB}","accept":"application/json"}
    else:             # v3 api key
        sep="&" if "?" in path else "?"; url=f"{base}{path}{sep}api_key={TMDB}"; headers={"accept":"application/json"}
    st,tx=http("GET",url,headers)
    if st!=200: print(f"    ! tmdb {st} {path[:50]}"); return None
    try: return json.loads(tx)
    except Exception: return None
def fetch_all(path):
    rows=[]; off=0
    while True:
        st,tx=sb("GET",f"{path}{'&' if '?' in path else '?'}limit=1000&offset={off}")
        if st!=200: raise RuntimeError(f"{st}: {tx[:200]}")
        b=json.loads(tx); rows+=b
        if len(b)<1000: break
        off+=1000
    return rows
def slugify(s):
    s=re.sub(r"[^a-z0-9]+","-",(s or "").lower()).strip("-"); return s[:80] or "x"

def cert_of(rd):
    """Pick a recognizable certification: US first, then KR, then any non-empty."""
    if not rd: return None
    by={r["iso_3166_1"]:r.get("release_dates",[]) for r in rd.get("results",[])}
    for region in ("US","KR","GB"):
        for d in by.get(region,[]):
            if d.get("certification"): return f'{region}:{d["certification"]}'
    for region,ds in by.items():
        for d in ds:
            if d.get("certification"): return f'{region}:{d["certification"]}'
    return None

def trailer_of(vids):
    """Official YouTube trailer key (prefer official Trailer, then any Trailer, then Clip)."""
    if not vids: return None
    r=[v for v in vids.get("results",[]) if v.get("site")=="YouTube"]
    for pred in (lambda v: v.get("type")=="Trailer" and v.get("official"),
                 lambda v: v.get("type")=="Trailer",
                 lambda v: v.get("type") in ("Teaser","Clip")):
        for v in r:
            if pred(v): return v.get("key"), v.get("name")
    return None

def top_backdrops(imgs, n=6):
    if not imgs: return []
    b=imgs.get("backdrops",[])
    # textless first (iso_639_1 null), then by vote
    b=sorted(b, key=lambda x:(x.get("iso_639_1") is not None, -(x.get("vote_average") or 0)))
    return b[:n]

def main():
    sel="id,tmdb_id,title,slug,year,director,director_slug"
    q=f"films?select={sel}&tmdb_id=not.is.null"
    if FILMS: q+="&slug=in.("+",".join(FILMS)+")"
    films=[f for f in fetch_all(q)][:LIMIT]
    print(f"[tmdb] {len(films)} films{'' if PERSIST else '  [DRY — fetch+print, no DB writes]'}")
    if not films: print("  nothing to do"); return

    seen_dir={}   # slug -> (person_id, name) to dedupe director fetches
    nf=nm=nd=0
    for f in films:
        tid=f["tmdb_id"]
        detail=tmdb(f"/movie/{tid}")
        if not detail: print(f"  ! {f['slug']}: no detail"); continue
        credits=tmdb(f"/movie/{tid}/credits") or {}
        rd=tmdb(f"/movie/{tid}/release_dates")
        vids=tmdb(f"/movie/{tid}/videos")
        imgs=tmdb(f"/movie/{tid}/images?include_image_language=en,null")
        cast=[{"name":c.get("name"),"character":c.get("character")} for c in (credits.get("cast") or [])[:6]]
        writers=[c.get("name") for c in (credits.get("crew") or []) if c.get("job") in ("Screenplay","Writer")][:3]
        director=next((c for c in (credits.get("crew") or []) if c.get("job")=="Director"), None)
        cert=cert_of(rd); tr=trailer_of(vids); bds=top_backdrops(imgs)
        extra={"cast":cast,"writers":writers,
               "country":[c.get("iso_3166_1") for c in (detail.get("production_countries") or [])],
               "original_language":detail.get("original_language"),
               "vote_average":detail.get("vote_average"),
               "collection":(detail.get("belongs_to_collection") or {}).get("name")}
        upd={"backdrop_path":detail.get("backdrop_path"),"tagline":detail.get("tagline") or None,
             "runtime":detail.get("runtime") or None,"release_date":detail.get("release_date") or None,
             "certification":cert,"tmdb_extra":extra}
        print(f"  · {f['slug']}: runtime={upd['runtime']} cert={cert} trailer={'Y' if tr else '-'} "
              f"backdrops={len(bds)} cast={len(cast)} dir={director['name'] if director else '?'}")
        if not PERSIST: continue
        # films update
        sb("PATCH",f"films?id=eq.{f['id']}",upd,prefer="return=minimal")
        # reset + insert this film's AI media
        sb("DELETE",f"media?entity_type=eq.film&entity_id=eq.{f['id']}&source=in.(tmdb,youtube)&added_by=eq.ai",prefer="return=minimal")
        rows=[]
        for i,b in enumerate(bds):
            fp=b["file_path"]; rows.append({"entity_type":"film","entity_id":f["id"],"kind":"image","source":"tmdb",
                "external_id":fp,"url":f"{IMG}/w1280{fp}","thumbnail_url":f"{IMG}/w300{fp}",
                "title":f"{f['title']} — still","attribution":"TMDB","position":i,"added_by":"ai"})
        if tr:
            key,name=tr; rows.append({"entity_type":"film","entity_id":f["id"],"kind":"video","source":"youtube",
                "external_id":key,"url":f"https://www.youtube.com/watch?v={key}",
                "thumbnail_url":f"https://i.ytimg.com/vi/{key}/hqdefault.jpg","title":name or "Trailer",
                "attribution":"YouTube (via TMDB)","position":0,"added_by":"ai"})
        if rows: sb("POST","media",rows,prefer="return=minimal")
        nf+=1; nm+=len(rows)
        # director
        if director and f.get("director_slug"):
            ds=f["director_slug"]
            if ds not in seen_dir:
                seen_dir[ds]=True
                person=tmdb(f"/person/{director['id']}") or {}
                drow={"slug":ds,"name":director["name"],"tmdb_person_id":director["id"],
                      "profile_path":person.get("profile_path"),"bio":person.get("biography") or None,
                      "birthday":person.get("birthday") or None,"place_of_birth":person.get("place_of_birth"),
                      "tmdb_extra":{"known_for":person.get("known_for_department")}}
                # upsert by slug
                st,tx=sb("POST","directors",drow,prefer="resolution=merge-duplicates,return=representation")
                did=None
                if st<300 and tx and json.loads(tx): did=json.loads(tx)[0]["id"]
                else:
                    g=sb("GET",f"directors?select=id&slug=eq.{urllib.parse.quote(ds)}&limit=1")
                    if g[0]==200 and json.loads(g[1]): did=json.loads(g[1])[0]["id"]
                if did and person.get("profile_path"):
                    pp=person["profile_path"]
                    sb("DELETE",f"media?entity_type=eq.director&entity_id=eq.{did}&source=eq.tmdb",prefer="return=minimal")
                    sb("POST","media",[{"entity_type":"director","entity_id":did,"kind":"image","source":"tmdb",
                        "external_id":pp,"url":f"{IMG}/w342{pp}","thumbnail_url":f"{IMG}/w185{pp}",
                        "title":director["name"],"attribution":"TMDB","position":0,"added_by":"ai"}],prefer="return=minimal")
                nd+=1
        time.sleep(0.25)
    if PERSIST:
        print(f"[tmdb] PERSIST done: {nf} films updated, {nm} media rows, {nd} directors. Deploy to render.")
    else:
        print("[tmdb] DRY done. Re-run with --persist to write (after migration 0015).")

if __name__=="__main__": main()
