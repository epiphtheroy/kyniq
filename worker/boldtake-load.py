#!/usr/bin/env python3
"""boldtake-load — load Strong Misreadings (bold-take-full.jsonl, 1,934 films) into the DB.
Resolves each take's figure anchor, plans per-film 'title'/'film' figures and any new-label
figures (deduped within a film), normalizes framework labels, treats the invitation as a
lead take. DRY (default) writes a deterministic plan (boldtake-load-plan.json) + report; no
writes. APPLY path is added after DRY review.

Anchoring: take.figure is an exact figure label, or 'film' / 'title' (→ per-film special
figures), or a new label (→ a new figure). Invitation → a take (framework=INVITATION,
is_invitation) anchored to the film's 'film' figure. New figures get worker-assigned uuids
so the plan is deterministic; apply ensures (film_id, slug) uniqueness vs existing.
"""
import os, sys, json, re, uuid, urllib.request, urllib.error
from collections import defaultdict, Counter

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
args=sys.argv[1:]; APPLY="--apply" in args
JSONL=os.path.join(HERE,"bold-take-full.jsonl"); PLAN=os.path.join(HERE,"boldtake-load-plan.json")

CANON={"PHENOMENON→NOUMENON","NOUMENON","SIGNIFIER→SIGNIFIED","CONTEXT","PROCESS","LOCATION",
 "METACRITIC","PSYCHOANALYTIC","ETHICAL-PHILOSOPHICAL","ETHICO-POLITICAL","ENIGMA",
 "PERSONA-PARALLEL","JUXTAPOSITION","TITLE","INVITATION"}
NORM={"NOUMENON (THING-IN-ITSELF)":"NOUMENON","PERSANA-PARALLEL":"PERSONA-PARALLEL",
 "ETHICO-PHILOSOPHICAL":"ETHICAL-PHILOSOPHICAL","OVERLAPPING VOICE-OVERS":"PROCESS",
 "THE RE-ENACTMENT SOUND":"PROCESS","STATIC ATROCITY TABLEAU AS ETHICAL FORM":"ETHICO-POLITICAL",
 "PLOT-STRUCTURE":"SIGNIFIER→SIGNIFIED","NARRATIVE-INVERSION":"ENIGMA"}
def norm_fw(f):
    f=(f or "").strip()
    if f in CANON: return f
    u=f.upper()
    if u in NORM: return NORM[u]
    base=re.sub(r"\s*\(.*\)$","",f).strip()
    if base in CANON: return base
    return None

def http(method,url,headers=None,body=None,timeout=240):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(url,method=method,data=data); req.add_header("Content-Type","application/json")
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
def fetch_all(path):
    rows=[]; off=0
    while True:
        st,tx=http("GET",f"{URL}/rest/v1/{path}&limit=1000&offset={off}",{"apikey":KEY,"Authorization":f"Bearer {KEY}"})
        if st!=200: raise RuntimeError(f"fetch {st}: {tx[:160]}")
        b=json.loads(tx); rows+=b
        if len(b)<1000: break
        off+=1000
    return rows
def slugify(s):
    s=re.sub(r"<[^>]+>","",s or "").lower(); s=re.sub(r"[^a-z0-9]+","-",s).strip("-"); return s[:72] or "x"
def nlabel(s): return re.sub(r"\s+"," ",(s or "").strip()).lower()

def resolve():
    rows=[json.loads(l) for l in open(JSONL,encoding="utf-8") if l.strip()]
    print(f"  {len(rows)} films from {os.path.basename(JSONL)}; fetching films + approved figures …")
    films={f["slug"]:f for f in fetch_all("films?select=id,slug,title,year")}
    figs_by_film=defaultdict(dict)
    for g in fetch_all("figures?select=id,film_id,label&status=eq.approved"):
        figs_by_film[g["film_id"]][nlabel(g["label"])]=g["id"]
    figures_create=[]; takes=[]
    anchor=Counter(); fwcount=Counter(); fw_unknown=Counter(); newlabels=[]; not_found=[]; invitations=0
    for r in rows:
        fm=films.get(r["slug"])
        if not fm: not_found.append(r["slug"]); continue
        fid=fm["id"]; fmap=figs_by_film.get(fid,{})
        used_slugs=set(); newcache={}; film_id_fig=[None]; title_id_fig=[None]
        def new_fig(kind,label):
            nid=str(uuid.uuid4()); base=slugify(label); slug=base; n=2
            while slug in used_slugs: slug=f"{base}-{n}"; n+=1
            used_slugs.add(slug)
            figures_create.append({"id":nid,"film_id":fid,"kind":kind,"label":label,"slug":slug,
                "description":{"title":"The film's title.","film":"The film as a whole."}.get(kind,"")})
            return nid
        def film_fig():
            if film_id_fig[0] is None: film_id_fig[0]=new_fig("film","The film as a whole")
            return film_id_fig[0]
        def title_fig():
            if title_id_fig[0] is None: title_id_fig[0]=new_fig("title",fm.get("title") or r["slug"])
            return title_id_fig[0]
        inv=(r.get("invitation") or "").strip()
        if inv:
            invitations+=1
            takes.append({"figure_id":film_fig(),"rationale":inv,"take_title":None,"framework":"INVITATION",
                "leap":None,"strength":5,"theorist_name":None,"concept":None,"real_person":None,"is_invitation":True})
        for t in r.get("takes",[]):
            fw=norm_fw(t.get("framework"))
            if fw is None: fw_unknown[(t.get("framework") or "?")]+=1; fw="SIGNIFIER→SIGNIFIED"
            fwcount[fw]+=1
            a=(t.get("figure") or "").strip(); al=a.lower()
            if al=="film": ref=film_fig(); anchor["film"]+=1
            elif al=="title": ref=title_fig(); anchor["title"]+=1
            elif nlabel(a) in fmap: ref=fmap[nlabel(a)]; anchor["exact"]+=1
            else:
                nl=nlabel(a) or "(unnamed)"
                if nl in newcache: ref=newcache[nl]; anchor["new_dup"]+=1
                else:
                    ref=new_fig("form",a or "(unnamed)"); newcache[nl]=ref; anchor["new"]+=1
                    if len(newlabels)<15: newlabels.append(f"{r['slug']}: {a[:60]}")
            takes.append({"figure_id":ref,"rationale":(t.get("thesis") or "").strip(),
                "take_title":(t.get("title") or "").strip() or None,"framework":fw,
                "leap":(t.get("leap") or "").strip() or None,"strength":int(t.get("strength") or 0) or None,
                "theorist_name":t.get("theorist") or None,"concept":t.get("concept") or None,
                "real_person":t.get("real_person") or None,"is_invitation":False})
    stats=dict(anchor=dict(anchor),fwcount=dict(fwcount),fw_unknown=dict(fw_unknown),
               newlabels=newlabels,not_found=not_found,invitations=invitations,
               n_takes=len(takes),n_figs=len(figures_create))
    return figures_create, takes, stats

def report(figures_create, takes, st):
    a=st["anchor"]
    sp=Counter(f["kind"] for f in figures_create)
    print("\n===== PLAN (DRY) =====")
    print(f"take rows to insert: {len(takes):,}  (incl. {st['invitations']:,} invitations)")
    print(f"figures to create: {len(figures_create):,}  = film {sp.get('film',0):,} + title {sp.get('title',0):,} + new-label {sp.get('form',0):,}")
    print(f"anchor: exact {a.get('exact',0):,} · film {a.get('film',0):,} · title {a.get('title',0):,} · new {a.get('new',0):,} · new-dup→reused {a.get('new_dup',0):,}")
    print(f"   existing-figure match rate among real figures: {100*a.get('exact',0)/max(1,a.get('exact',0)+a.get('new',0)):.1f}%")
    print(f"films not found: {len(st['not_found'])}")
    if st["fw_unknown"]: print("unknown framework labels →SIGNIFIER→SIGNIFIED:", st["fw_unknown"])
    print("sample new-label figures:"); [print("   ",s) for s in st["newlabels"][:12]]
    print("framework distribution:")
    for k in sorted(st["fwcount"], key=lambda x:-st["fwcount"][x]): print(f"   {st['fwcount'][k]:>5}  {k}")

def rpc(name, payload):
    st,tx=http("POST",f"{URL}/rest/v1/rpc/{name}",
               {"apikey":KEY,"Authorization":f"Bearer {KEY}"},payload)
    if st not in (200,204): raise RuntimeError(f"rpc {name} {st}: {tx[:200]}")
    return tx
def chunks(lst,n):
    for i in range(0,len(lst),n): yield lst[i:i+n]

def apply_plan():
    if not os.path.exists(PLAN): sys.exit(f"No {os.path.basename(PLAN)} — run DRY first.")
    plan=json.load(open(PLAN,encoding="utf-8")); figs=plan["figures_create"]; tks=plan["takes"]
    print(f"[apply] plan: {len(figs):,} figures · {len(tks):,} takes")
    pf=json.loads(rpc("boldtake_preflight",{})); print("  preflight:",pf)
    if pf.get("new_takes",0)>0: sys.exit(f"ABORT: {pf['new_takes']} new takes already exist — apply appears already done. (Restore from _bak_* if you must re-run.)")
    if pf.get("bak_takes",0)<40000: sys.exit(f"ABORT: snapshot _bak_boldtake_takes has only {pf.get('bak_takes')} rows — backup missing/incomplete.")
    nf=0
    for c in chunks(figs,500):
        nf+=int(rpc("boldtake_insert_figures",{"p_rows":c})); print(f"  figures: {nf:,}/{len(figs):,}",end="\r",flush=True)
    print(f"\n  ✅ figures inserted: {nf:,}")
    nt=0
    for c in chunks(tks,1000):
        nt+=int(rpc("boldtake_insert_takes",{"p_rows":c})); print(f"  takes: {nt:,}/{len(tks):,}",end="\r",flush=True)
    print(f"\n  ✅ takes inserted: {nt:,}")
    na=int(rpc("boldtake_archive_old",{})); print(f"  ✅ old serial takes archived → retired: {na:,}")
    pf2=json.loads(rpc("boldtake_preflight",{})); print("  post:",pf2)
    print("\n✅ APPLY complete. Verify on the site / tell Claude.")

def main():
    print(f"[boldtake-load] mode={'APPLY' if APPLY else 'DRY'}")
    if APPLY: apply_plan(); return
    figures_create, takes, st = resolve()
    json.dump({"figures_create":figures_create,"takes":takes}, open(PLAN,"w",encoding="utf-8"), ensure_ascii=False)
    report(figures_create, takes, st)
    print(f"\n✅ wrote {os.path.basename(PLAN)} (deterministic).  --apply consumes THIS file; old takes (framework IS NULL) → retired after insert.")

if __name__=="__main__": main()
