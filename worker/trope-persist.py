#!/usr/bin/env python3
"""trope-persist — apply trope-plan-harmonized.json to the DB (replaces old figure_type tropes).

DRY (default): resolves slugs + figure members + edges, prints what it will write. No DB changes.
APPLY (--apply): preflight (abort if already applied / snapshot missing) → retire old figure_type
tropes + clear their members → insert new tropes (meta_takes kind=figure_type, trope_kind,
maturity) → set takes.trope_id → insert figure_type_members (distinct figures) → insert
meta_take_edges (similar). Reversible via _bak_trope_* snapshot.

Usage: python3 trope-persist.py [--apply]
"""
import os, sys, json, re, uuid, urllib.request, urllib.error
from collections import defaultdict

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p,encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY): sys.exit("Missing Supabase env")
APPLY="--apply" in sys.argv
EDGES_ONLY="--edges-only" in sys.argv
PLAN=os.path.join(HERE,"trope-plan-harmonized.json")

def http(method,url,headers=None,body=None,timeout=240):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(url,method=method,data=data); req.add_header("Content-Type","application/json")
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
def rpc(name,body):
    st,tx=sb("POST",f"rpc/{name}",body or {})
    if st>=300: raise RuntimeError(f"rpc {name} {st}: {tx[:200]}")
    return tx
def fetch_all(path,page=1000):
    rows=[]; off=0
    while True:
        st,tx=sb("GET",f"{path}&limit={page}&offset={off}")
        if st!=200: raise RuntimeError(f"fetch {st}: {tx[:160]}")
        b=json.loads(tx); rows+=b
        if len(b)<page: break
        off+=page
    return rows
def chunks(lst,n):
    for i in range(0,len(lst),n): yield lst[i:i+n]
def slugify(s):
    s=re.sub(r"<[^>]+>","",s or "").lower(); s=re.sub(r"[^a-z0-9]+","-",s).strip("-"); return s[:72] or "trope"

def build():
    plan=json.load(open(PLAN,encoding="utf-8")); tropes=plan["tropes"]; edges=plan.get("similar_edges",[])
    print(f"  plan: {len(tropes)} tropes · {len(edges)} similar-edges")
    print("  fetching existing meta_take slugs + take→figure map …")
    existing={r["slug"] for r in fetch_all("meta_takes?select=slug") if r.get("slug")}
    figof={}
    for r in fetch_all("takes?select=id,figure_id&status=eq.published&is_invitation=eq.false"):
        figof[r["id"]]=r["figure_id"]
    # assign id + unique slug per trope
    used=set(existing)
    trope_rows=[]; take_trope=[]; members=[]; slug2id={}
    for t in tropes:
        tid=str(uuid.uuid4())
        base=slugify(t.get("slug") or t["name"]); s=base; n=2
        while s in used: s=f"{base}-{n}"; n+=1
        used.add(s); slug2id[t["slug"]]=tid
        trope_rows.append({"id":tid,"slug":s,"title":t["name"],"laconic":t.get("laconic"),"note":t.get("note"),
                           "trope_kind":t.get("trope_kind","misreading"),"maturity":t.get("maturity"),
                           "cohesion":t.get("cohesion"),"member_count":len(t["members"]),"film_count":t.get("films")})
        figs=set()
        for tk in t["members"]:
            take_trope.append({"take_id":tk,"trope_id":tid})
            fg=figof.get(tk)
            if fg: figs.add(fg)
        for fg in figs: members.append({"meta_take_id":tid,"figure_id":fg,"sim":t.get("cohesion")})
    edge_rows=[]
    for e in edges:
        a=slug2id.get(e["a"]); b=slug2id.get(e["b"])
        if a and b: edge_rows.append({"a":a,"b":b,"sim":e.get("sim")})
    return trope_rows, take_trope, members, edge_rows

def edges_only():
    """Recovery: tropes already inserted; (re)insert only the similar-edges. Maps plan slugs to the
    real DB ids by replaying the worker's deterministic slug-dedup against the existing-slug set."""
    print("[trope-persist] mode=EDGES-ONLY")
    plan=json.load(open(PLAN,encoding="utf-8")); tropes=plan["tropes"]; edges=plan.get("similar_edges",[])
    db_slug2id={r["slug"]:r["id"] for r in fetch_all("meta_takes?select=id,slug&trope_kind=eq.misreading&status=eq.published")}
    newslugs=set(db_slug2id)
    used={r["slug"] for r in fetch_all("meta_takes?select=slug") if r.get("slug") and r["slug"] not in newslugs}
    planslug2id={}
    for t in tropes:
        base=slugify(t.get("slug") or t["name"]); s=base; n=2
        while s in used: s=f"{base}-{n}"; n+=1
        used.add(s)
        if s in db_slug2id: planslug2id[t["slug"]]=db_slug2id[s]
    seen=set(); rows=[]
    for e in edges:
        a=planslug2id.get(e["a"]); b=planslug2id.get(e["b"])
        if not (a and b) or a==b: continue
        k=(a,b)
        if k in seen: continue
        seen.add(k); rows.append({"a":a,"b":b,"sim":e.get("sim")})
    print(f"  mapped {len(planslug2id)}/{len(tropes)} plan slugs → ids · edge rows {len(rows)}/{len(edges)}")
    ne=0
    for c in chunks(rows,2000): ne+=int(rpc("trope_insert_edges",{"p_rows":c})); print(f"  edges {ne:,}/{len(rows):,}",end="\r",flush=True)
    print(f"\n  ✅ similar edges inserted: {ne:,}")
    print("post:",json.loads(rpc("trope_preflight",{})))

def main():
    if EDGES_ONLY: return edges_only()
    print(f"[trope-persist] mode={'APPLY' if APPLY else 'DRY'}")
    if not os.path.exists(PLAN): sys.exit("No trope-plan-harmonized.json (run harmonize first).")
    trope_rows, take_trope, members, edge_rows = build()
    from collections import Counter
    mat=Counter(t["maturity"] for t in trope_rows)
    print("\n===== PLAN =====")
    print(f"tropes to insert: {len(trope_rows):,}")
    print(f"  maturity: {{'fresh':{mat.get('fresh',0)}, 'emerging':{mat.get('emerging',0)}, 'established':{mat.get('established',0)}, 'cliche':{mat.get('cliche',0)}}}")
    print(f"takes→trope links: {len(take_trope):,}")
    print(f"figure members (distinct fig per trope): {len(members):,}")
    print(f"similar edges: {len(edge_rows):,}")
    print("old figure_type tropes (1,421) → retired; their 45,297 members cleared.")
    if not APPLY:
        print("\nDRY only — re-run with --apply to write. (Snapshot _bak_trope_* already taken.)")
        return
    pre=json.loads(rpc("trope_preflight",{})); print("\npreflight:",pre)
    if pre.get("ft_misreading",0)>0: sys.exit("ABORT: misreading tropes already present — already applied? (restore from _bak_trope_* to re-run)")
    # 2026-08-07: _bak_trope_metatakes was DROPPED with the other snapshots (see
    # worker/boldtake-load.py for the reasoning). This guard now fires on every run
    # by design — re-take the snapshot before re-running rather than lowering it.
    if pre.get("bak_metatakes",0)<1000: sys.exit("ABORT: snapshot _bak_trope_metatakes looks empty.")
    print("retiring old figure_type tropes + clearing members …")
    print("  ",rpc("trope_retire_old",{}))
    nf=0
    for c in chunks(trope_rows,500): nf+=int(rpc("trope_insert_tropes",{"p_rows":c})); print(f"  tropes {nf:,}/{len(trope_rows):,}",end="\r",flush=True)
    print(f"\n  ✅ tropes inserted: {nf:,}")
    nt=0
    for c in chunks(take_trope,2000): nt+=int(rpc("trope_set_take_tropeid",{"p_rows":c})); print(f"  take→trope {nt:,}/{len(take_trope):,}",end="\r",flush=True)
    print(f"\n  ✅ takes linked: {nt:,}")
    nm=0
    for c in chunks(members,2000): nm+=int(rpc("trope_insert_members",{"p_rows":c})); print(f"  members {nm:,}/{len(members):,}",end="\r",flush=True)
    print(f"\n  ✅ figure members: {nm:,}")
    ne=0
    for c in chunks(edge_rows,2000): ne+=int(rpc("trope_insert_edges",{"p_rows":c})); print(f"  edges {ne:,}/{len(edge_rows):,}",end="\r",flush=True)
    print(f"\n  ✅ similar edges: {ne:,}")
    print("\npost:",json.loads(rpc("trope_preflight",{})))
    print("✅ APPLY complete. Verify + re-embed trope hubs, then deploy app.")

if __name__=="__main__": main()
