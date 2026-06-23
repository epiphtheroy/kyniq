#!/usr/bin/env python3
"""Apply the REVIEWED trope-consolidation plan (trope-consolidate-dry.json) via
server-side RPCs. Applies exactly what was reviewed — does NOT re-run the LLM.

Reversible: readings are RETIRED (status='retired', merged_into set), not deleted;
a full snapshot lives in _bak_consol_meta_takes / _bak_consol_ftm.

Guard: aborts if no published readings remain (already applied).

Usage:  python3 trope-consolidate-apply.py
"""
import os, sys, json, re, urllib.request, urllib.error
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY): sys.exit("Missing SUPABASE env")
PLAN=os.path.join(HERE,"trope-consolidate-dry.json")

def http(method,url,headers=None,body=None,timeout=240):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(url,method=method,data=data); req.add_header("Content-Type","application/json")
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:600]
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
def rpc(name,body):
    st,tx=sb("POST",f"rpc/{name}",body)
    if st>=300: raise RuntimeError(f"rpc {name} {st}: {tx[:300]}")
    return json.loads(tx) if tx.strip() else None
def slugify(s):
    s=re.sub(r"<[^>]+>","",s or "").lower(); s=re.sub(r"[^a-z0-9]+","-",s).strip("-"); return s[:72] or "trope"

def main():
    plan=json.load(open(PLAN,encoding="utf-8"))
    # ---- guard: already applied? ----
    st,tx=sb("GET","meta_takes?select=id&kind=eq.reading&status=eq.published&limit=1")
    if st==200 and not json.loads(tx):
        sys.exit("No published readings remain — plan appears ALREADY APPLIED. Aborting (no double-apply).")
    print(f"plan: {len(plan['surviving_new'])} new tropes · {len(plan['reading_final'])} readings · "
          f"{len(plan['existing_merges'])} merges · {len(plan['existing_renames'])} renames")

    # ---- 1) insert promoted-new tropes (unique slugs) ----
    seen=set(); newrows=[]
    for s in plan["surviving_new"]:
        sl=slugify(s["title"]); base=sl; n=2
        while sl in seen: sl=f"{base}-{n}"; n+=1
        seen.add(sl)
        newrows.append({"key":s["key"],"title":s["title"],"laconic":s.get("laconic"),"slug":sl})
    keyid={}
    if newrows:
        res=rpc("consol_insert_new_tropes",{"p_rows":newrows})
        keyid={r["key"]:r["id"] for r in (res or [])}
        print(f"  ✓ inserted {len(keyid)}/{len(newrows)} new tropes")

    # ---- 2) fold readings (project figures + retire) ----
    pmap=[]; miss=0
    for rid,info in plan["reading_final"].items():
        t=info.get("to_existing") or keyid.get(info.get("to_newkey"))
        if not t: miss+=1; continue
        pmap.append({"r":rid,"t":t})
    n=rpc("consol_fold_readings",{"p_map":pmap})
    print(f"  ✓ folded readings: mapped {len(pmap)}, retired {n}" + (f"  (UNMAPPED {miss}!)" if miss else ""))

    # ---- 3) merge existing trope duplicates ----
    if plan["existing_merges"]:
        pairs=[{"loser":m["loser"],"survivor":m["survivor"]} for m in plan["existing_merges"]]
        rpc("consol_merge_tropes",{"p_pairs":pairs}); print(f"  ✓ merged {len(pairs)} existing trope dups")
    # ---- 4) rename canonicalized tropes ----
    if plan["existing_renames"]:
        rpc("consol_rename_tropes",{"p_rows":plan["existing_renames"]}); print(f"  ✓ renamed {len(plan['existing_renames'])}")

    # ---- verify (Content-Range carries the exact count) ----
    import urllib.request as u
    def cnt(path):
        req=u.Request(f"{URL}/rest/v1/{path}&limit=1",
                      headers={"apikey":KEY,"Authorization":f"Bearer {KEY}","Prefer":"count=exact","Range":"0-0"})
        try:
            with u.urlopen(req,timeout=60) as r: return r.headers.get("Content-Range","?")
        except Exception as e: return str(e)
    print("  tropes (published figure_type):", cnt("meta_takes?select=id&kind=eq.figure_type&status=eq.published"))
    print("  readings still published:", cnt("meta_takes?select=id&kind=eq.reading&status=eq.published"))
    print("  figure_type_members rows:", cnt("figure_type_members?select=figure_id"))
    print("✅ applied. Tell Claude to verify + do the app redirects.")

if __name__=="__main__": main()
