#!/usr/bin/env python3
"""Meta Take dual ranking (build step 4b) — relevance + surprise.

For each published meta take: embed its takes' rationales, compute
  relevance = cosine(take_rationale, meta_take.embedding)   (prototypicality)
  surprise  = 1 - relevance                                  (in-cluster outlier
              = same concept, different surface = the unexpected kin)
Write meta_take_rankings with rel_rank (relevance desc) and surp_rank
(surprise desc). The page shows defining cases (rel) + unexpected kin (surp).
Re-runnable. Usage: python3 mt-rank.py [--limit N] [--dry]
"""
import os, sys, json, math, urllib.request, urllib.error, urllib.parse
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p,encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY"); OPENAI=os.environ.get("OPENAI_API_KEY")
if not (URL and KEY and OPENAI): print("Missing env (Supabase + OPENAI_API_KEY)"); sys.exit(1)
args=sys.argv[1:]; DRY="--dry" in args
LIMIT=int(args[args.index("--limit")+1]) if "--limit" in args else 100000
def http(method,url,headers=None,body=None,timeout=120):
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
def embed(texts):
    out=[]
    for i in range(0,len(texts),300):
        st,tx=http("POST","https://api.openai.com/v1/embeddings",{"Authorization":f"Bearer {OPENAI}"},
            {"model":"text-embedding-3-small","input":texts[i:i+300]})
        if st!=200: raise RuntimeError(f"embed {st}: {tx[:160]}")
        out.extend([d["embedding"] for d in sorted(json.loads(tx)["data"],key=lambda d:d["index"])])
    return out
def norm(v):
    n=math.sqrt(sum(x*x for x in v)) or 1.0; return [x/n for x in v]
def cos(a,b): return sum(x*y for x,y in zip(a,b))
def main():
    sel=("id,slug,embedding,takes(id,rationale,figure_id)")
    st,tx=sb("GET",f"meta_takes?select={urllib.parse.quote(sel,safe='!,():*')}&status=eq.published&limit={LIMIT}")
    if st!=200: print(f"{st}: {tx[:200]}"); sys.exit(1)
    mts=json.loads(tx)
    print(f"[rank] {len(mts)} published meta takes{' [DRY]' if DRY else ''}")
    if DRY:
        print("  (dry) would embed + rank", sum(len(m.get('takes') or []) for m in mts), "takes"); return
    sb("DELETE","meta_take_rankings?meta_take_id=not.is.null",prefer="return=minimal")
    total=0
    for mt in mts:
        takes=[t for t in (mt.get("takes") or []) if t.get("rationale") and t.get("figure_id")]
        if not takes or not mt.get("embedding"): continue
        cen=mt["embedding"]
        if isinstance(cen,str): cen=json.loads(cen)
        cen=norm(cen)
        embs=[norm(v) for v in embed([t["rationale"][:1000] for t in takes])]
        scored=[]
        for t,e in zip(takes,embs):
            rel=cos(e,cen); scored.append({"figure_id":t["figure_id"],"rel":rel,"surp":1.0-rel})
        # dedupe by figure (keep best rel)
        byfig={}
        for s in scored:
            if s["figure_id"] not in byfig or s["rel"]>byfig[s["figure_id"]]["rel"]: byfig[s["figure_id"]]=s
        items=list(byfig.values())
        for i,s in enumerate(sorted(items,key=lambda x:-x["rel"])): s["rel_rank"]=i+1
        for i,s in enumerate(sorted(items,key=lambda x:-x["surp"])): s["surp_rank"]=i+1
        rows=[{"meta_take_id":mt["id"],"figure_id":s["figure_id"],
               "relevance":round(s["rel"],4),"surprise":round(s["surp"],4),
               "rel_rank":s["rel_rank"],"surp_rank":s["surp_rank"],"model":"openai-emb"} for s in items]
        for i in range(0,len(rows),200):
            sb("POST","meta_take_rankings",rows[i:i+200],prefer="return=minimal")
        total+=len(rows)
    print(f"[rank] done: {total} rankings written")
if __name__=="__main__": main()
