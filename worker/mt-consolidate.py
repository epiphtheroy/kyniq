#!/usr/bin/env python3
"""mt-consolidate v2 — dedup hubs, gate, and split oversized hubs (<= CAP).

Replaces the old raw_concept re-cluster (it ignored v2 takes: only 4.6k of 18k
carry raw_concept). v2 operates on the hubs the figure-enrich batch already built:

  1. DEDUP — hub_dup_pairs(THRESH) (pgvector cosine) → union-find groups of
     near-identical hubs. Keep one canonical per group (published > most films >
     most takes); re-link the others' takes to it; delete the merged-away hubs.
  2. GATE  — report hubs with < GATE distinct films (they just won't be authored;
     no deletion, they stay invisible candidates).
  3. SPLIT — any hub with > CAP distinct figures is divided by recursive cosine
     2-means on its takes' embeddings until every part <= CAP figures. The largest
     part stays on the hub (keeps its slug; essay cleared + status→candidate so
     mt-author rewrites it to match); each other part becomes a new candidate hub;
     takes re-linked; parent↔child sibling edges added.

pgvector does the O(n²) dedup; clustering is pure-Python (per-hub sets are small),
so no numpy needed. DEFAULT IS DRY — pass --persist to write.

Usage: python3 mt-consolidate.py [--persist] [--cap 70] [--thresh 0.86] [--gate 5]
"""
import os, sys, json, re, random, math, urllib.request, urllib.error, urllib.parse
from collections import defaultdict
random.seed(7)

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p,encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY): print("Missing env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)"); sys.exit(1)

args=sys.argv[1:]; PERSIST="--persist" in args
def argf(flag,default):
    return type(default)(args[args.index(flag)+1]) if flag in args else default
CAP=argf("--cap",70); THRESH=argf("--thresh",0.86); GATE=argf("--gate",5)
TARGET=max(20, int(CAP*0.7))   # children aim well under the cap

def http(method,url,headers=None,body=None,timeout=180):
    import time
    data=json.dumps(body).encode() if body is not None else None
    for attempt in range(4):
        req=urllib.request.Request(url,method=method,data=data); req.add_header("Content-Type","application/json")
        for k,v in (headers or {}).items(): req.add_header(k,v)
        try:
            with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
        except urllib.error.HTTPError as e: return e.code, e.read().decode()[:400]
        except urllib.error.URLError:
            if attempt==3: raise
            time.sleep(2*(attempt+1))   # transient (conn reset / timeout) → retry
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
def rpc(name,body):
    st,tx=sb("POST",f"rpc/{name}",body);
    if st>=300: raise RuntimeError(f"rpc {name} {st}: {tx[:200]}")
    return json.loads(tx) if tx.strip() else []
def fetch_all(path):
    rows=[]; off=0
    while True:
        st,tx=sb("GET",f"{path}&limit=1000&offset={off}")
        if st!=200: raise RuntimeError(f"fetch {st}: {tx[:200]}")
        b=json.loads(tx); rows+=b
        if len(b)<1000: break
        off+=1000
    return rows
def slugify(s):
    s=re.sub(r"<[^>]+>","",s or "").lower(); s=re.sub(r"[^a-z0-9]+","-",s).strip("-"); return s[:60] or "x"
def parse_vec(v):
    if isinstance(v,str): return json.loads(v)
    return v
def unit(v):
    n=math.sqrt(sum(x*x for x in v)) or 1.0; return [x/n for x in v]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def centroid(vs):
    d=len(vs[0]); c=[0.0]*d
    for v in vs:
        for i in range(d): c[i]+=v[i]
    return unit([x/len(vs) for x in c])

def two_means(items, iters=12):
    # items: list of (take_id, figure_id, unit_vec). cosine 2-means.
    vecs=[it[2] for it in items]
    c0=vecs[0]; c1=min(vecs, key=lambda v: dot(v,c0))  # farthest (lowest cosine) from c0
    A=B=None
    for _ in range(iters):
        A=[];B=[]
        for it in items:
            (A if dot(it[2],c0)>=dot(it[2],c1) else B).append(it)
        if not A or not B: return items,[]   # degenerate
        c0=centroid([x[2] for x in A]); c1=centroid([x[2] for x in B])
    return A,B
def nfigs(items): return len({it[1] for it in items})
def split_recursive(items, depth=0):
    if nfigs(items)<=CAP or depth>=6: return [items]
    A,B=two_means(items)
    if not B: return [items]   # couldn't separate (near-identical) → accept
    return split_recursive(A,depth+1)+split_recursive(B,depth+1)

def main():
    print(f"[consolidate v2] cap={CAP} thresh={THRESH} gate={GATE} {'PERSIST' if PERSIST else 'DRY'}")
    hubs=fetch_all("meta_takes?select=id,slug,title,status,created_at,raw_concept&id=not.is.null")
    hub={h['id']:h for h in hubs}
    takes=fetch_all("takes?select=id,meta_take_id,figure_id,figure:figures!inner(film_id)&meta_take_id=not.is.null")
    hub_takes=defaultdict(list)
    for t in takes:
        hub_takes[t['meta_take_id']].append({'id':t['id'],'figure_id':t['figure_id'],'film_id':t['figure']['film_id']})
    films_of=lambda h:{x['film_id'] for x in hub_takes.get(h,[])}
    figs_of =lambda h:{x['figure_id'] for x in hub_takes.get(h,[])}
    print(f"  {len(hubs)} hubs, {len(takes)} linked takes")

    # ---- 1. DEDUP ----
    try:
        pairs=rpc("hub_dup_pairs",{"p_threshold":THRESH})
    except Exception as e:
        print(f"  dedup: SKIPPED ({str(e)[:120]}) — proceeding to split"); pairs=[]
    parent={}
    def find(x):
        parent.setdefault(x,x)
        while parent[x]!=x: parent[x]=parent[parent[x]]; x=parent[x]
        return x
    def union(a,b): parent[find(a)]=find(b)
    for p in pairs:
        if p['a'] in hub and p['b'] in hub: union(p['a'],p['b'])
    groups=defaultdict(list)
    for hid in list(parent): groups[find(hid)].append(hid)
    merge_plan=[]
    for members in groups.values():
        members=[m for m in members if m in hub]
        if len(members)<=1: continue
        canon=max(members,key=lambda h:(1 if hub[h]['status']=='published' else 0,len(films_of(h)),len(hub_takes.get(h,[]))))
        losers=[m for m in members if m!=canon]
        merge_plan.append((canon,losers))
    n_losers=sum(len(l) for _,l in merge_plan)
    print(f"  dedup: {len(pairs)} pairs → {len(merge_plan)} merge groups, {n_losers} hubs merged away")

    if PERSIST:
        for canon,losers in merge_plan:
            for lo in losers:
                sb("PATCH",f"takes?meta_take_id=eq.{lo}",{"meta_take_id":canon},prefer="return=minimal")
                sb("DELETE",f"meta_takes?id=eq.{lo}",prefer="return=minimal")
    # update local model regardless (so split sees merged sizes / dry preview is accurate)
    for canon,losers in merge_plan:
        for lo in losers:
            hub_takes[canon]+=hub_takes.get(lo,[])
            hub_takes.pop(lo,None); hub.pop(lo,None)

    # ---- 2. GATE (report) ----
    survivors=list(hub)
    sub_gate=[h for h in survivors if len(films_of(h))<GATE]
    print(f"  gate: {len(survivors)} surviving hubs, {len(sub_gate)} below {GATE} films (won't be authored)")

    # ---- 3. SPLIT ----
    over=[h for h in survivors if len(figs_of(h))>CAP]
    over.sort(key=lambda h:-len(figs_of(h)))
    print(f"  split: {len(over)} hubs over {CAP} figures (max {len(figs_of(over[0])) if over else 0})")
    used_slugs={hub[h]['slug'] for h in hub if hub[h].get('slug')}
    new_children=0
    for h in over:
        emb=fetch_all(f"takes?select=id,figure_id,embedding&meta_take_id=eq.{h}&embedding=not.is.null")
        items=[(r['id'],r['figure_id'],unit(parse_vec(r['embedding']))) for r in emb]
        if len({it[1] for it in items})<=CAP:
            print(f"    · {hub[h]['slug']}: {len(figs_of(h))} figs but only {len(items)} embedded takes — skip (run mt-embed first)"); continue
        parts=split_recursive(items)
        parts.sort(key=lambda pt:-nfigs(pt))
        sizes=[nfigs(pt) for pt in parts]
        print(f"    · {hub[h]['slug']}: {len(figs_of(h))} figs → {len(parts)} parts {sizes}")
        if len(parts)<=1: continue
        if not PERSIST: continue
        # largest part stays on h; clear essay + back to candidate so mt-author rewrites
        sb("PATCH",f"meta_takes?id=eq.{h}",{"essay":None,"status":"candidate","updated_at":"now()"},prefer="return=minimal")
        base=slugify(hub[h]['title']); k=2
        for pt in parts[1:]:
            slug=f"{base}-{k}"
            while slug in used_slugs: k+=1; slug=f"{base}-{k}"
            used_slugs.add(slug); k+=1
            cen=centroid([it[2] for it in pt])
            row={"slug":slug,"title":hub[h]['title'][:200],"raw_concept":hub[h].get('raw_concept'),
                 "status":"candidate","source":"ai","embedding":cen}
            st,tx=sb("POST","meta_takes",[row],prefer="return=representation")
            if st>=300: print(f"      ! child insert {st}: {tx[:140]}"); continue
            child=json.loads(tx)[0]["id"]; new_children+=1
            ids=[it[0] for it in pt]
            for i in range(0,len(ids),200):
                sb("PATCH",f"takes?id=in.({','.join(ids[i:i+200])})",{"meta_take_id":child},prefer="return=minimal")
            sb("POST","meta_take_edges",{"a":h,"b":child,"relation":"sibling"},prefer="return=minimal")

    print(f"  split: created {new_children} child hubs" if PERSIST else "  split: (dry — no writes)")
    print(f"[consolidate v2] {'DONE' if PERSIST else 'DRY complete'}. Next: mt-author.py → mt-rank.py → mt-recommend.py")

if __name__=="__main__": main()
