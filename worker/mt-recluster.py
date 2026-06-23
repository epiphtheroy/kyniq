#!/usr/bin/env python3
"""mt-recluster — clean up reading meta-take hubs (quality mode).

Problem: 935 published reading hubs but only 298 distinct names; many distinct
clusters share a generic title, a few are true duplicates, and 62 hubs are too
broad (>70 takes). Embedding-only merge over-merges (45% of hubs fall under 0.12
cosine), so MERGE decisions are made by the LLM, grounded in each hub's readings.

PHASES (idempotent; DRY by default):
  1. MERGE  — candidate components = (same title) ∪ (embedding distance < 0.08).
              The LLM, given each member's sample readings, returns a distinct,
              specific Title-Case name per member; members it judges the SAME
              reading get the IDENTICAL name → merged (takes moved to survivor =
              most films; losers set merged_into + status='retired', kept for the
              301 redirect). No size cap here — the split phase handles breadth.
  2. SPLIT  — any hub with >70 takes is split by TAKE embeddings (k-means, pure
              Python) into <=70 semantic sub-hubs: the largest sub-cluster stays on
              the original hub; the rest become new hubs, each LLM-named.
  3. RENAME — any titles still shared after 1-2 are made globally unique.
  4. EMBED  — every changed hub re-embedded (title+thesis), seo_phrase nulled.

Usage:
  python3 mt-recluster.py                  # DRY: preview first --limit components + split plan
  python3 mt-recluster.py --limit 8        # DRY, preview 8 components
  python3 mt-recluster.py --persist        # apply ALL phases
Opts: --model claude-opus-4-8  --samples 6  --simdist 0.08  --maxtakes 70
"""
import os, sys, json, re, time, math, random, urllib.request, urllib.error
from collections import defaultdict

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))

URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
OPENAI=os.environ.get("OPENAI_API_KEY"); ANT=os.environ.get("ANTHROPIC_API_KEY")
args=sys.argv[1:]
PERSIST="--persist" in args
def argv(f,d): return type(d)(args[args.index(f)+1]) if f in args else d
LIMIT=argv("--limit", 6); SAMPLES=argv("--samples", 6)
SIMDIST=argv("--simdist", 0.08); MAXTAKES=argv("--maxtakes", 70)
MODEL=args[args.index("--model")+1] if "--model" in args else "claude-opus-4-8"
EMB_MODEL="text-embedding-3-small"
if not (URL and KEY and ANT): sys.exit("Missing env (Supabase URL + SERVICE_ROLE_KEY + ANTHROPIC_API_KEY)")
if PERSIST and not OPENAI: sys.exit("Missing OPENAI_API_KEY (needed to re-embed)")

def http(method,url,headers=None,body=None,timeout=180):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(url,method=method,data=data); req.add_header("Content-Type","application/json")
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:500]
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
def rpc(name,body=None):
    st,tx=sb("POST",f"rpc/{name}",body or {})
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

def call_llm(system,user,max_tokens=2000):
    body={"model":MODEL,"max_tokens":max_tokens,"system":system,"messages":[{"role":"user","content":user}]}
    for a in range(8):
        st,tx=http("POST","https://api.anthropic.com/v1/messages",
                   {"x-api-key":ANT,"anthropic-version":"2023-06-01"},body,timeout=180)
        if st==200:
            obj=json.loads(tx); return "".join(p.get("text","") for p in obj.get("content",[]) if p.get("type")=="text")
        if st in (429,500,502,503,520,529) and a<7: time.sleep(min(60,5*(a+1))); continue
        raise RuntimeError(f"llm {st}: {tx[:200]}")
def parse_json(s):
    s=s.strip()
    if s.startswith("```"): s=re.sub(r"^```[a-z]*\n?","",s); s=re.sub(r"\n?```$","",s)
    i=s.find("{"); j=s.rfind("}")
    if i>=0 and j>i: s=s[i:j+1]
    return json.loads(s)
def embed(texts):
    out=[]
    for i in range(0,len(texts),128):
        chunk=[(t or " ")[:8000] for t in texts[i:i+128]]
        for a in range(4):
            st,tx=http("POST","https://api.openai.com/v1/embeddings",
                       {"Authorization":f"Bearer {OPENAI}"},{"model":EMB_MODEL,"input":chunk})
            if st==200: break
            if a==3: raise RuntimeError(f"embed {st}: {tx[:200]}")
            time.sleep(2*(a+1))
        out.extend(d["embedding"] for d in sorted(json.loads(tx)["data"],key=lambda d:d["index"]))
    return out
def slugify(s):
    s=re.sub(r"<[^>]+>","",s or "").lower(); s=re.sub(r"[^a-z0-9]+","-",s).strip("-"); return s[:76] or "x"

# ---- pure-python cosine k-means (small N) ----
def _norm(v):
    s=math.sqrt(sum(x*x for x in v)) or 1.0; return [x/s for x in v]
def _dot(a,b): return sum(x*y for x,y in zip(a,b))
def to_vec(e): return json.loads(e) if isinstance(e,str) else e   # PostgREST returns vector cols as text
def kmeans(vecs,k,iters=14,seed=1):
    random.seed(seed); n=len(vecs); k=max(2,min(k,n))
    cents=[vecs[random.randrange(n)]]
    while len(cents)<k:
        d=[min(1-_dot(v,c) for c in cents) for v in vecs]; tot=sum(d) or 1.0
        r=random.random()*tot; acc=0; pick=n-1
        for i,dd in enumerate(d):
            acc+=dd
            if acc>=r: pick=i; break
        cents.append(vecs[pick])
    assign=[0]*n
    for _ in range(iters):
        for i,v in enumerate(vecs):
            bs=-2; bi=0
            for ci,c in enumerate(cents):
                s=_dot(v,c)
                if s>bs: bs=s; bi=ci
            assign[i]=bi
        nc=[]
        for ci in range(k):
            mem=[vecs[i] for i in range(n) if assign[i]==ci]
            if not mem: nc.append(cents[ci]); continue
            dim=len(mem[0]); avg=[0.0]*dim
            for m in mem:
                for j in range(dim): avg[j]+=m[j]
            nc.append(_norm([a/len(mem) for a in avg]))
        cents=nc
    return assign

def samples_for(hub_id):
    sel="rationale,register,figure:figures(label,film:films(title,year))"
    st,tx=sb("GET",f"takes?select={sel}&meta_take_id=eq.{hub_id}&order=confidence.desc&limit={SAMPLES}")
    if st!=200: return []
    out=[]
    for t in json.loads(tx):
        fig=(t.get("figure") or {}); film=(fig.get("film") or {})
        out.append({"film":f"{film.get('title','?')} ({film.get('year','')})".strip(),
                    "register":t.get("register") or "","fig":fig.get("label") or "",
                    "rationale":(t.get("rationale") or "")[:220]})
    return out

SYS_NAME=("You are FilmCurio's film critic. A META-TAKE is an INTERPRETATION — a recurring critical READING "
    "grounded in a critical register / theoretical perspective (psychoanalytic, ideological, formal, existential, "
    "mythic, philosophical, semiotic, politico-economic, film-historical, reception). It is NOT a mere recurring "
    "motif/object/situation — that is a 'trope'. You are given several hubs (each with sample readings + a dominant "
    "lens). FIRST CLUSTER them: put hubs that make the SAME core critical argument (the same reading through the "
    "same lens) into ONE cluster — merge genuine duplicates and trivial rephrasings aggressively (e.g. five hubs "
    "all reading composure as emotional labor are ONE cluster); keep two apart only when the interpretive CLAIM "
    "truly differs, not just surface wording. THEN give each cluster one DISTINCT, specific Title Case name stating "
    "its interpretive claim, a laconic (<=14 words), and a 2-3 sentence thesis argued THROUGH its lens. Every input "
    "index must appear in exactly one cluster. No first person, no jargon dumps. "
    'Return ONLY JSON: {"clusters":[{"members":[<indices>],"title":"...","laconic":"...","thesis":"..."}]}')

def name_clusters(members, shared_hint=None):
    head=(f'These {len(members)} meta-take hubs may overlap'+(f' (many share "{shared_hint}")' if shared_hint else '')
          +'. CLUSTER true duplicates together (same core argument), then name each cluster as a distinct interpretation:\n')
    lines=[head]
    for k,m in enumerate(members):
        lens=", ".join(m.get("dom") or []) or "—"
        anchor=f'dominant lens: {lens}; rooted concept: {(m.get("raw_concept") or "—")[:90]}'
        if m.get("theorist"): anchor+=f'; tradition: {m["theorist"]}'
        lines.append(f'[i={k}] {anchor}')
        lines.append(f'    current title: "{m["title"]}"  sample readings:')
        for s in (m["samples"] or [])[:SAMPLES]:
            lines.append(f"  - ({s['film']}; {s['register']}; figure: {s['fig']}) {s['rationale']}")
        if not m["samples"]: lines.append(f"  - (thesis) {m.get('thesis') or m.get('laconic') or ''}")
        lines.append("")
    mt=min(8000,600+len(members)*240)
    out=parse_json(call_llm(SYS_NAME,"\n".join(lines),max_tokens=mt))
    return out.get("clusters",[])

SYS_SUB=("You are FilmCurio's film critic. A META-TAKE is an INTERPRETATION — a critical reading grounded in a "
    "theoretical lens, not a motif. A too-broad hub was split by meaning into sub-clusters. Name THIS sub-cluster "
    "as a DISTINCT interpretive claim (Title Case, different from the parent), with a laconic (<=14 words) and a "
    "2-3 sentence thesis that argues the reading through the lens evident in its sample readings. No first person, "
    'no jargon dumps. Return ONLY JSON: {"title":"...","laconic":"...","thesis":"..."}')
def name_sub(parent_title, samples):
    lines=[f'Parent hub (too broad): "{parent_title}". Name this sub-cluster from its readings:']
    for s in samples[:SAMPLES]:
        lines.append(f"  - ({s['film']}; {s['register']}; figure: {s['fig']}) {s['rationale']}")
    return parse_json(call_llm(SYS_SUB,"\n".join(lines),max_tokens=600))

def uf_find(p,x):
    p.setdefault(x,x)
    while p[x]!=x: p[x]=p[p[x]]; x=p[x]
    return x
def uf_union(p,a,b):
    ra,rb=uf_find(p,a),uf_find(p,b)
    if ra!=rb: p[ra]=rb

def main():
    print(f"[recluster] model={MODEL}  simdist={SIMDIST}  maxtakes={MAXTAKES}  mode={'PERSIST' if PERSIST else 'DRY'}")
    hubs={h["id"]:h for h in fetch_all(
        "meta_takes?select=id,slug,title,laconic,thesis,raw_concept,created_at&kind=eq.reading&status=eq.published")}
    fc={r["meta_take_id"]:r["film_count"] for r in fetch_all("meta_take_film_counts?select=meta_take_id,film_count")}
    tc={r["id"]:r["n"] for r in rpc("reading_hub_take_counts")}
    for hid,h in hubs.items(): h["films"]=fc.get(hid,0); h["takes"]=tc.get(hid,0)
    # interpretive anchors: dominant critical register(s) + theory tradition (theorist)
    reg=defaultdict(list)
    for r in rpc("reading_hub_registers"): reg[r["id"]].append((r["register"],r["n"]))
    def dom_regs(hid): return [x[0] for x in sorted(reg.get(hid,[]),key=lambda y:-y[1])[:2]]
    thr={}
    try:
        for r in fetch_all("meta_takes?select=id,theorist:theorists(name)&kind=eq.reading&status=eq.published&theorist_id=not.is.null"):
            if r.get("theorist"): thr[r["id"]]=r["theorist"].get("name")
    except Exception: pass
    print(f"  hubs={len(hubs)}  distinct titles={len(set(h['title'] for h in hubs.values()))}  >{MAXTAKES} takes={sum(1 for h in hubs.values() if h['takes']>MAXTAKES)}")

    # ---- candidate components: same-title OR embedding distance < SIMDIST ----
    p={}
    bytitle=defaultdict(list)
    for hid,h in hubs.items(): bytitle[h["title"]].append(hid)
    for ids in bytitle.values():
        for x in ids[1:]: uf_union(p,ids[0],x)
    for pr in rpc("reading_hub_dup_pairs",{"p_max_dist":SIMDIST,"p_k":8}):
        if pr["a"] in hubs and pr["b"] in hubs: uf_union(p,pr["a"],pr["b"])
    comps=defaultdict(list)
    for hid in hubs: comps[uf_find(p,hid)].append(hid)
    comps=[ids for ids in comps.values() if len(ids)>1]
    comps.sort(key=lambda ids:-len(ids))
    print(f"  merge/rename candidate components: {len(comps)} (covering {sum(len(c) for c in comps)} hubs)")

    used={h["title"].lower() for h in hubs.values()}
    def unique_title(t, top_film=""):
        t=(t or "").strip()[:200]; low=t.lower()
        if low not in used: return t
        if top_film:
            c=f"{t} ({top_film})"[:200]
            if c.lower() not in used: return c
        n=2
        while f"{t} ({n})".lower() in used: n+=1
        return f"{t} ({n})"[:200]

    renamed={}   # hub_id -> (title,laconic,thesis)
    merges=[]    # (loser, survivor)
    todo=comps if PERSIST else comps[:LIMIT]
    # hub embeddings for the components we'll process — so big chained components are
    # sub-clustered by MEANING (kindred readings grouped together) instead of by index,
    # which lets the LLM actually merge true duplicates within a coherent group.
    comp_ids=[i for ids in todo for i in ids]; emb={}
    for i in range(0,len(comp_ids),80):
        for r in fetch_all("meta_takes?select=id,embedding&embedding=not.is.null&id=in.("+",".join(comp_ids[i:i+80])+")"):
            if r.get("embedding"): emb[r["id"]]=_norm(to_vec(r["embedding"]))
    def subcluster(ids):
        pts=[i for i in ids if i in emb]; miss=[i for i in ids if i not in emb]
        if len(pts)<=14: return [ids]
        k=math.ceil(len(pts)/12)
        for _t in range(6):
            asg=kmeans([emb[i] for i in pts],k); sz=defaultdict(int)
            for a in asg: sz[a]+=1
            if max(sz.values())<=16 or k>=12: break
            k+=1
        g=defaultdict(list)
        for i,a in zip(pts,asg): g[a].append(i)
        out=[v for v in g.values()]
        if miss and out: out[0]=out[0]+miss
        return out
    for ci,ids in enumerate(todo,1):
        for ids_c in (subcluster(ids) if len(ids)>14 else [ids]):
            members=[]
            for hid in ids_c:
                h=hubs[hid]; members.append({**h,"id":hid,"samples":samples_for(hid),"dom":dom_regs(hid),"theorist":thr.get(hid)})
            hint=max(set(hubs[i]["title"] for i in ids_c), key=lambda t:sum(1 for i in ids_c if hubs[i]["title"]==t))
            try: clusters=name_clusters(members,hint)
            except Exception as e: print(f"  ! component {ci} LLM error {e}"); continue
            print(f"\n[{ci}/{len(todo)}] group x{len(ids_c)} (~\"{hint}\") -> {len(clusters)} clusters")
            seen=set()
            for cl in clusters:
                idxs=[k for k in (cl.get("members") or []) if isinstance(k,int) and 0<=k<len(members) and k not in seen]
                if not idxs: continue
                seen.update(idxs)
                mem=sorted((members[k] for k in idxs), key=lambda m:(-m["films"], m["created_at"]))
                surv=mem[0]
                top=(surv["samples"][0]["film"].split(" (")[0] if surv["samples"] else "")
                final=unique_title((cl.get("title") or surv["title"]), top)
                used.discard(surv["title"].lower()); used.add(final.lower())
                tag="MERGE←" if len(mem)>1 else ("rename" if final!=surv["title"] else "keep")
                extra=f"  absorbs {[m['slug'] for m in mem[1:]]}" if len(mem)>1 else ""
                print(f"    {tag} \"{final}\" [survivor {surv['slug']} {surv['films']}f/{surv['takes']}t]{extra}")
                renamed[surv["id"]]=(final, cl.get("laconic"), cl.get("thesis"))
                hubs[surv["id"]]["title"]=final
                for lo in mem[1:]:
                    merges.append((lo["id"],surv["id"]))
                    hubs[surv["id"]]["takes"]+=lo["takes"]; hubs[surv["id"]]["films"]+=lo["films"]
                    if PERSIST:
                        sb("PATCH",f"takes?meta_take_id=eq.{lo['id']}",{"meta_take_id":surv["id"]},prefer="return=minimal")
                        sb("PATCH",f"meta_takes?id=eq.{lo['id']}",{"merged_into":surv["id"],"status":"retired","updated_at":"now()"},prefer="return=minimal")
                    hubs.pop(lo["id"],None)
                if PERSIST:
                    sb("PATCH",f"meta_takes?id=eq.{surv['id']}",
                       {"title":final,"laconic":cl.get("laconic"),"thesis":cl.get("thesis"),"seo_phrase":None,"updated_at":"now()"},prefer="return=minimal")

    # ---- SPLIT hubs > MAXTAKES ----
    over=[hid for hid,h in hubs.items() if h["takes"]>MAXTAKES]
    print(f"\n[split] hubs over {MAXTAKES} takes: {len(over)}")
    new_hub_ids=[]
    for hid in (over if PERSIST else over[:0]):   # DRY: preview only (count); PERSIST: do it
        h=hubs[hid]
        trows=fetch_all(f"takes?select=id,embedding&meta_take_id=eq.{hid}&embedding=not.is.null")
        trows=[t for t in trows if t.get("embedding")]
        if len(trows)<=MAXTAKES: continue
        vecs=[_norm(to_vec(t["embedding"])) for t in trows]
        k=math.ceil(len(trows)/55)
        for _try in range(6):
            asg=kmeans(vecs,k)
            sizes=defaultdict(int)
            for a in asg: sizes[a]+=1
            if max(sizes.values())<=MAXTAKES or k>=8: break
            k+=1
        groups=defaultdict(list)
        for t,a in zip(trows,asg): groups[a].append(t["id"])
        order=sorted(groups.values(), key=len, reverse=True)
        keep=order[0]  # largest stays on original hub
        print(f"    split {h['slug']} ({len(trows)}t) -> {len(order)} sub ({[len(g) for g in order]})")
        for sub in order[1:]:
            samp_ids=sub[:SAMPLES]
            sel="rationale,register,figure:figures(label,film:films(title,year))"
            samps=[]
            for tid in samp_ids:
                stx,tx=sb("GET",f"takes?select={sel}&id=eq.{tid}")
                if stx==200 and json.loads(tx):
                    t=json.loads(tx)[0]; fig=(t.get("figure") or {}); film=(fig.get("film") or {})
                    samps.append({"film":f"{film.get('title','?')} ({film.get('year','')})","register":t.get('register') or "","fig":fig.get('label') or "","rationale":(t.get('rationale') or '')[:220]})
            try: sg=name_sub(h["title"],samps)
            except Exception as e: print(f"      ! sub-name error {e}"); continue
            title=unique_title(sg.get("title") or f"{h['title']} (aspect)")
            used.add(title.lower())
            slug=slugify(title); base=slug; n=2
            existing={r["slug"] for r in fetch_all("meta_takes?select=slug")} if PERSIST else set()
            while slug in existing: slug=f"{base}-{n}"; n+=1
            row={"slug":slug,"title":title,"laconic":sg.get("laconic"),"thesis":sg.get("thesis"),
                 "raw_concept":h.get("raw_concept"),"kind":"reading","status":"published","source":"ai"}
            st,tx=sb("POST","meta_takes",[row],prefer="return=representation")
            if st>=300: print(f"      ! sub insert {st}: {tx[:140]}"); continue
            nid=json.loads(tx)[0]["id"]; new_hub_ids.append(nid)
            for i in range(0,len(sub),200):
                ids_in="("+",".join(sub[i:i+200])+")"
                sb("PATCH",f"takes?id=in.{ids_in}",{"meta_take_id":nid},prefer="return=minimal")
            renamed[nid]=(title,sg.get("laconic"),sg.get("thesis"))
            print(f"      + new sub-hub \"{title}\" [{slug}] ({len(sub)}t)")
    if not PERSIST and over:
        print(f"    (DRY) would split {len(over)} hubs by take-embedding k-means into <= {MAXTAKES}")

    print(f"\n[recluster] components={len(todo)}  renamed/created={len(renamed)}  merges={len(merges)}  split_new={len(new_hub_ids)}")
    if not PERSIST:
        print("  DRY — no writes. Re-run with --persist to apply ALL phases."); return

    # ---- re-embed every changed hub (title+thesis changed) ----
    ids=list(renamed); texts=[f'{renamed[i][0]}. {renamed[i][2] or renamed[i][1] or ""}'.strip() for i in ids]
    print(f"  re-embedding {len(ids)} changed hubs…")
    vecs=embed(texts)
    for i in range(0,len(ids),100):
        rows=[{"id":ids[j],"e":vecs[j]} for j in range(i,min(i+100,len(ids)))]
        st,tx=sb("POST","rpc/bulk_set_embeddings",{"p_kind":"meta_take","p_rows":rows},prefer="return=minimal")
        if st>=300: print(f"    ! embed writeback {st}: {tx[:160]}")
    print("✅ recluster done. NEXT: mt-relate.py (differences + links), then mt-rank/mt-recommend + SEO fetch + deploy /take redirect.")

if __name__=="__main__": main()
