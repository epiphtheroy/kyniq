#!/usr/bin/env python3
"""Meta Take consolidation (build step 3) — births meta_takes from takes.

Pipeline:
  1. Fetch all takes (raw_concept, theorist, figure→film), distinct concepts.
  2. Group by normalize_concept (merges case/article/punct variants).
  3. Embed each normalized concept (OpenAI) and merge near-duplicate groups
     via connected components at cosine >= MERGE_THRESHOLD.
  4. For each merged cluster: count DISTINCT films. If >= GATE (5) → create a
     meta_take (status=candidate), pick title, assign majority theory_family +
     theorist, store centroid embedding; then set takes.meta_take_id for all
     takes in the cluster. Below gate → leave takes unlinked (orphan).
  5. Flag clusters > SPLIT (30) as split candidates (logged + content_events).

Re-runnable: clears meta_takes + nulls takes.meta_take_id first (idempotent).
Usage: python3 mt-consolidate.py [--dry] [--merge 0.86]
"""
import os, sys, json, math, re, urllib.request, urllib.error, urllib.parse
from collections import defaultdict, Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mt_consolidate_core import normalize_concept, components, choose_title, normalize_vec

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p,encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
OPENAI=os.environ.get("OPENAI_API_KEY")
if not (URL and KEY and OPENAI): print("Missing env (Supabase + OPENAI_API_KEY)"); sys.exit(1)
args=sys.argv[1:]; DRY="--dry" in args
MERGE=float(args[args.index("--merge")+1]) if "--merge" in args else 0.86
GATE=5; SPLIT=30

def http(method,url,headers=None,body=None,timeout=120):
    req=urllib.request.Request(url,method=method,data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type","application/json")
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:400]
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
def slugify(s):
    s=re.sub(r"<[^>]+>","",s or "").lower(); s=re.sub(r"[^a-z0-9]+","-",s).strip("-"); return s[:70] or "x"
def embed(texts):
    out=[]
    for i in range(0,len(texts),300):
        st,tx=http("POST","https://api.openai.com/v1/embeddings",
            {"Authorization":f"Bearer {OPENAI}"},{"model":"text-embedding-3-small","input":texts[i:i+300]})
        if st!=200: raise RuntimeError(f"embed {st}: {tx[:200]}")
        out.extend([d["embedding"] for d in sorted(json.loads(tx)["data"],key=lambda d:d["index"])])
    return out
def fetch_all(path):
    rows=[]; off=0
    while True:
        st,tx=sb("GET",f"{path}&limit=1000&offset={off}")
        if st!=200: raise RuntimeError(f"{st}: {tx[:200]}")
        b=json.loads(tx); rows+=b
        if len(b)<1000: break
        off+=1000
    return rows

def main():
    # 1. takes with concept + figure→film + theorist + family(via theorist? no: family from take? we stored theory family only via theorist link indirectly)
    sel="id,raw_concept,theorist_id,figure:figures!inner(film_id)"
    takes=fetch_all(f"takes?select={urllib.parse.quote(sel,safe='!,():*')}&raw_concept=not.is.null")
    print(f"[consolidate] {len(takes)} takes with concept")
    # theory family per take: derive from seed? we stored family only as table; takes lack family fk.
    # Use theorist→family majority later; for family we re-read from a take's seed is unavailable,
    # so assign meta_take.theory_family by theorist's most common family is not stored. Skip family for now
    # (authoring step can set). We still set theorist.

    # group by normalized concept
    norm_groups=defaultdict(list)   # norm -> list of take dicts
    norm_label=defaultdict(list)    # norm -> original labels
    for t in takes:
        n=normalize_concept(t["raw_concept"])
        if not n: continue
        norm_groups[n].append(t); norm_label[n].append(t["raw_concept"].strip())
    norms=list(norm_groups.keys())
    print(f"[consolidate] {len(norms)} normalized concepts")
    if DRY:
        # report distribution without network
        film_of=lambda t: t["figure"]["film_id"]
        counts=sorted(((n,len({film_of(x) for x in norm_groups[n]})) for n in norms), key=lambda x:-x[1])
        ge=[c for c in counts if c[1]>=GATE]
        print(f"[consolidate] (dry, pre-embedding-merge) concepts >= {GATE} films: {len(ge)} | top:",[(c[0][:24],c[1]) for c in counts[:6]])
        return

    # 3. embed + merge near-duplicate normalized concepts
    vecs=[normalize_vec(v) for v in embed(norms)]
    clusters=components(norms, vecs, MERGE)   # list of lists of norm-keys
    print(f"[consolidate] {len(clusters)} clusters after embedding merge (θ={MERGE})")

    # reset meta layer
    sb("PATCH","takes?meta_take_id=not.is.null",{"meta_take_id":None},prefer="return=minimal")
    sb("DELETE","meta_takes?id=not.is.null",prefer="return=minimal")

    used_slugs=set(); created=0; orphan=0; splitc=0; linked=0
    norm_index={n:i for i,n in enumerate(norms)}
    for cl in clusters:
        cl_takes=[t for n in cl for t in norm_groups[n]]
        films={t["figure"]["film_id"] for t in cl_takes}
        labels=[lab for n in cl for lab in norm_label[n]]
        if len(films) < GATE:
            orphan+=1; continue
        title=choose_title(labels)
        slug=slugify(title); base=slug; k=2
        while slug in used_slugs: slug=f"{base}-{k}"; k+=1
        used_slugs.add(slug)
        # majority theorist
        ths=[t["theorist_id"] for t in cl_takes if t.get("theorist_id")]
        theorist=Counter(ths).most_common(1)[0][0] if ths else None
        # centroid
        idxs=[norm_index[n] for n in cl]
        cen=normalize_vec([sum(vecs[i][d] for i in idxs)/len(idxs) for d in range(len(vecs[0]))])
        row={"slug":slug,"title":title[:200],"raw_concept":cl[0],"status":"candidate",
             "theorist_id":theorist,"embedding":cen,"source":"ai"}
        st,tx=sb("POST","meta_takes",[row],prefer="return=representation")
        if st>=300: print(f"[consolidate] meta_take insert {st}: {tx[:160]}"); continue
        mt_id=json.loads(tx)[0]["id"]; created+=1
        # link takes
        take_ids=[t["id"] for t in cl_takes]
        for i in range(0,len(take_ids),200):
            ids=",".join(take_ids[i:i+200])
            sb("PATCH",f"takes?id=in.({ids})",{"meta_take_id":mt_id},prefer="return=minimal")
        linked+=len(take_ids)
        if len(films) > SPLIT:
            splitc+=1
            sb("POST","content_events",{"entity_type":"meta_take","entity_id":mt_id,
                "event":"split_candidate","actor_kind":"ai","meta":{"slug":slug,"films":len(films)}},
                prefer="return=minimal")

    print(f"[consolidate] done: {created} meta_takes (candidate), {linked} takes linked, "
          f"{orphan} sub-gate clusters left orphan, {splitc} flagged >30 for split")
    print("[consolidate] next: mt-author.py (titles/essays) → admin approve → mt-rank.py / mt-recommend.py")

if __name__=="__main__": main()
