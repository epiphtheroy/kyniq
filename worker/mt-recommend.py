#!/usr/bin/env python3
"""Film recommendations (build step 4c) — film_affinities via TF-IDF.

Reads published meta takes + their takes' films, computes film-film affinity
weighted by meta-take rarity, stores top-20 per film with the shared meta
takes (the explainable reason). Re-runnable (clears film_affinities first).
Usage: python3 mt-recommend.py [--dry]
"""
import os, sys, json, urllib.request, urllib.error, urllib.parse
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mt_recommend_core import affinities
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p,encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY): print("Missing env"); sys.exit(1)
DRY="--dry" in sys.argv[1:]
def http(method,url,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}","Content-Type":"application/json"}
    if prefer: h["Prefer"]=prefer
    req=urllib.request.Request(url,method=method,data=json.dumps(body).encode() if body is not None else None)
    for k,v in h.items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=120) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
def sb(method,path,body=None,prefer=None): return http(method,f"{URL}/rest/v1/{path}",body,prefer)
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
    sel="meta_take_id,figure:figures!inner(film_id),meta_take:meta_takes!inner(status)"
    rows=fetch_all(f"takes?select={urllib.parse.quote(sel,safe='!,():*')}&meta_take_id=not.is.null&meta_take.status=eq.published")
    film_meta=defaultdict(set)
    for r in rows:
        film_meta[r["figure"]["film_id"]].add(r["meta_take_id"])
    print(f"[recommend] {len(film_meta)} films across published meta takes")
    aff=affinities(film_meta, top_n=20)
    total=sum(len(v) for v in aff.values())
    print(f"[recommend] {total} affinity pairs (top-20/film)")
    if DRY:
        ex=next(iter(aff.items())) if aff else None
        print("  sample:", ex[0] if ex else None, "->", [(b,s) for b,s,_ in (ex[1][:3] if ex else [])])
        return
    # per-film replace — one global DELETE of ~30k rows times out at the 8s limit.
    total_w=0; nf=0
    for f, lst in aff.items():
        nf+=1
        sb("DELETE",f"film_affinities?film_id=eq.{f}",prefer="return=minimal")
        rows_f=[{"film_id":f,"related_film_id":b,"score":s,"shared_meta_take_ids":shared} for b,s,shared in lst]
        for i in range(0,len(rows_f),300):
            st,tx=sb("POST","film_affinities",rows_f[i:i+300],prefer="return=minimal")
            if st>=300: print(f"[recommend] insert {st}: {tx[:160]}"); sys.exit(1)
        total_w+=len(rows_f)
        if nf%200==0: print(f"[recommend] …{nf} films, {total_w} rows", flush=True)
    print(f"[recommend] done: {total_w} rows written across {nf} films")
if __name__=="__main__": main()
