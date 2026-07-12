#!/usr/bin/env python3
"""Embeddings (downstream step 1) — fills take/figure/meta_take vector(1536).

Why: dedup (consolidate v2), semantic splitting of oversized hubs, dual ranking
(mt-rank), and semantic/hybrid search v2 all need embeddings. They are empty after
the figure-enrich batch. Model: OpenAI text-embedding-3-small (matches columns).

What gets embedded (each on its own axis — KEEP consistent):
  take      → rationale            (the reading / meaning)
  figure    → description          (the surface)
  meta_take → "title. thesis|laconic|raw_concept"  (the concept; ALL hubs, one basis,
              so consolidate's cosine compares like-with-like)

Writeback goes through the bulk_set_embeddings RPC (one call per ~100 rows) so a
dropped connection costs a batch, not the run. Idempotent: only null embeddings
unless --force (meta_take is always re-embedded for a consistent dedup basis).

Usage: python3 mt-embed.py [--dry] [--force] [--only take,figure,meta_take]
"""
import os, sys, json, urllib.request, urllib.error, urllib.parse

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
if not (URL and KEY and OPENAI): print("Missing env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + OPENAI_API_KEY)"); sys.exit(1)

args=sys.argv[1:]; DRY="--dry" in args; FORCE="--force" in args
ONLY=None
if "--only" in args: ONLY=set(args[args.index("--only")+1].split(","))
EMBED_BATCH=256          # texts per OpenAI call
WRITE_BATCH=100          # rows per writeback RPC call
MODEL="text-embedding-3-small"

def http(method,url,headers=None,body=None,timeout=180):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(url,method=method,data=data); req.add_header("Content-Type","application/json")
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:400]
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
def rpc(name,body):
    return sb("POST",f"rpc/{name}",body,prefer="return=minimal")
def fetch_all(path):
    rows=[]; off=0
    while True:
        st,tx=sb("GET",f"{path}&limit=1000&offset={off}")
        if st!=200: raise RuntimeError(f"fetch {st}: {tx[:200]}")
        b=json.loads(tx); rows+=b
        if len(b)<1000: break
        off+=1000
    return rows

def embed(texts):
    out=[]
    for i in range(0,len(texts),EMBED_BATCH):
        chunk=[ (t or "")[:8000] or " " for t in texts[i:i+EMBED_BATCH] ]
        # retry a few times on transient errors
        for attempt in range(4):
            st,tx=http("POST","https://api.openai.com/v1/embeddings",
                {"Authorization":f"Bearer {OPENAI}"},{"model":MODEL,"input":chunk})
            if st==200: break
            if attempt==3: raise RuntimeError(f"embed {st}: {tx[:200]}")
            import time; time.sleep(2*(attempt+1))
        data=sorted(json.loads(tx)["data"],key=lambda d:d["index"])
        out.extend([d["embedding"] for d in data])
        print(f"    embedded {min(i+EMBED_BATCH,len(texts))}/{len(texts)}")
    return out

def writeback(kind, ids, vecs):
    wrote=0
    for i in range(0,len(ids),WRITE_BATCH):
        if i: import time; time.sleep(0.5)   # IO pacing: sustained back-to-back vector writes helped exhaust the disk burst budget (2026-07-13 incident)
        rows=[{"id":ids[j],"e":vecs[j]} for j in range(i,min(i+WRITE_BATCH,len(ids)))]
        for attempt in range(4):
            st,tx=rpc("bulk_set_embeddings",{"p_kind":kind,"p_rows":rows})
            if st<300: break
            if attempt==3: raise RuntimeError(f"writeback {kind} {st}: {tx[:200]}")
            import time; time.sleep(2*(attempt+1))
        wrote+=len(rows); print(f"    wrote {wrote}/{len(ids)} {kind} embeddings")
    return wrote

def do(kind, select, text_of, where):
    rows=fetch_all(f"{kind_table(kind)}?select={urllib.parse.quote(select,safe='!,():*')}&{where}")
    rows=[r for r in rows if (text_of(r) or "").strip()]
    print(f"[embed] {kind}: {len(rows)} rows to embed{' [DRY]' if DRY else ''}")
    if DRY or not rows: return
    ids=[r["id"] for r in rows]; texts=[text_of(r) for r in rows]
    vecs=embed(texts)
    writeback(kind, ids, vecs)

def kind_table(kind): return {"take":"takes","figure":"figures","meta_take":"meta_takes"}[kind]

def main():
    want=lambda k: (ONLY is None) or (k in ONLY)
    if want("take"):
        # New model: embed the bold reading on its CODE — take_title + thesis — so similar
        # interpretive moves cluster together. Published only (retired old takes don't need it).
        where="rationale=not.is.null&status=eq.published" + ("" if FORCE else "&embedding=is.null")
        do("take","id,take_title,rationale",
           lambda r:(f'{r["take_title"]}. {r.get("rationale") or ""}'.strip() if r.get("take_title") else (r.get("rationale") or "")),
           where)
    if want("figure"):
        # Basis = description, falling back to label (new film/title/new-label figures may have thin descriptions).
        where="id=not.is.null" + ("" if FORCE else "&embedding=is.null")
        do("figure","id,label,description",lambda r:(r.get("description") or r.get("label")),where)
    if want("meta_take"):
        # ALL hubs, one consistent basis (so dedup compares like-with-like)
        def mt_text(r):
            return f'{r.get("title") or ""}. {r.get("thesis") or r.get("laconic") or r.get("raw_concept") or ""}'.strip()
        do("meta_take","id,title,thesis,laconic,raw_concept",mt_text,"id=not.is.null")
    print("[embed] done. Next: mt-consolidate.py (v2 dedup + gate + split).")

if __name__=="__main__": main()
