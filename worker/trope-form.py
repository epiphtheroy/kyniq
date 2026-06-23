#!/usr/bin/env python3
"""trope-form — re-form tropes as critic-gated CODES from Strong Misreadings.

Canon: docs/CONCEPT-tropes-and-strong-misreadings.md · docs/PLAN-trope-reformation.md.
Unit = the misreading (published, non-invitation take: take_title + thesis). A misreading
that recurs across films is a trope-in-the-making; a singular one is Noble.

STAGES (run in order; each gated):
  cluster  (this stage) — numpy leader-clustering of take embeddings → candidate clusters.
                          NO LLM. Prints size/cohesion distribution + samples so we tune tau.
                          Writes trope-clusters.json for the next stage. (DRY by nature.)
  gate     (next)        — LLM critic gate + naming (Opus, Batch) over candidates.
  finalize (next)        — maturity · kind · similar-trope links · persist.

No count cap. Cohesion is held naturally by tau; we never force a split/merge. Naming (next
stage) is where the quality goes.

Usage: python3 trope-form.py cluster [--tau 0.55] [--samples 6] [--show 30]
"""
import os, sys, json, re, time, math, random, urllib.request, urllib.error
import numpy as np

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY): sys.exit("Missing Supabase env")

args=sys.argv[1:]
STAGE=args[0] if args and not args[0].startswith("-") else "cluster"
def argf(flag,d):
    return type(d)(args[args.index(flag)+1]) if flag in args else d
TAU=argf("--tau",0.55); SAMPLES=int(argf("--samples",6)); SHOW=int(argf("--show",30))
SWEEP=[float(x) for x in argf("--taus","0.55,0.60,0.63,0.66,0.70").split(",")]
METHOD=argf("--method","twopass"); KNN_K=int(argf("--k",10)); MUTUAL=("--nomutual" not in args)
TAUCORE=argf("--taucore",0.64)     # core threshold for twopass (sweep value = tau_attach)
ANT=os.environ.get("ANTHROPIC_API_KEY")
GATE_MODEL=argf("--model","claude-opus-4-8"); PILOT=int(argf("--pilot",24)); BIGSPLIT=int(argf("--bigsplit",25))
HARM_MERGE=argf("--merge",0.85); HARM_SIM=argf("--sim",0.68); SIMK=int(argf("--simk",10))
CLUSTERS_JSON=os.path.join(HERE,"trope-clusters.json")
PLAN_JSON=os.path.join(HERE,"trope-plan.json")
PLAN_H_JSON=os.path.join(HERE,"trope-plan-harmonized.json")
HARM_CACHE=os.path.join(HERE,"trope-harmonize-cache.jsonl")

def http(method,url,headers=None,body=None,timeout=240):
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
def fetch_all(path, page=1000):
    rows=[]; off=0
    while True:
        st,tx=sb("GET",f"{path}&limit={page}&offset={off}")
        if st!=200: raise RuntimeError(f"fetch {st}: {tx[:200]}")
        b=json.loads(tx); rows+=b
        if len(b)<page: break
        off+=page
        print(f"    fetched {len(rows)} …", end="\r", flush=True)
    return rows

def load_takes():
    print("[cluster] fetching published non-invitation takes with embeddings …")
    # film/figure labels via nested select for sample display.
    sel=("id,take_title,framework,figure_id,embedding,"
         "figure:figures!inner(label,slug,film:films!inner(title,year,slug))")
    rows=fetch_all(f"takes?select={sel}&status=eq.published&is_invitation=eq.false&embedding=not.is.null",
                   page=500)
    print(f"\n[cluster] {len(rows)} takes loaded.")
    return rows

def to_vec(e): return np.asarray(json.loads(e) if isinstance(e,str) else e, dtype=np.float32)

def leader_cluster(X, tau):
    """Greedy single-pass leader clustering on L2-normalized rows (cosine == dot)."""
    n,d=X.shape
    cap=1024
    L=np.zeros((cap,d),dtype=np.float32); nL=0
    assign=np.empty(n,dtype=np.int32)
    for i in range(n):
        v=X[i]
        if nL:
            sims=L[:nL] @ v
            j=int(np.argmax(sims))
            if sims[j]>=tau:
                assign[i]=j; continue
        if nL==cap:
            cap*=2; L2=np.zeros((cap,d),dtype=np.float32); L2[:nL]=L[:nL]; L=L2
        L[nL]=v; assign[i]=nL; nL+=1
        if i and i%2000==0: print(f"    clustered {i}/{n}  leaders={nL}", end="\r", flush=True)
    print(f"    clustered {n}/{n}  leaders={nL}        ")
    return assign, nL

def knn_graph(X, k):
    """Compute top-k cosine neighbors per row (chunked). Independent of tau — built once, reused
    across a tau sweep (only the union step depends on tau)."""
    n=X.shape[0]; k=min(k,max(1,n-1))
    topk=np.empty((n,k),dtype=np.int32); tops=np.empty((n,k),dtype=np.float32)
    CH=1024
    for s in range(0,n,CH):
        e=min(s+CH,n)
        sims=X[s:e] @ X.T
        sims[np.arange(e-s), np.arange(s,e)] = -1.0          # mask self
        idx=np.argpartition(-sims,k-1,axis=1)[:,:k]
        topk[s:e]=idx; tops[s:e]=np.take_along_axis(sims,idx,axis=1)
        print(f"    knn graph {e}/{n}", end="\r", flush=True)
    print(f"    knn graph {n}/{n}        ")
    nbr=[set(int(j) for j in topk[i]) for i in range(n)]
    return topk, tops, nbr

def union_from_graph(graph, tau, mutual):
    """Mutual k-NN + union-find at threshold tau (cheap; reuses a prebuilt graph)."""
    topk,tops,nbr=graph; n=topk.shape[0]; k=topk.shape[1]
    parent=list(range(n))
    def find(x):
        while parent[x]!=x: parent[x]=parent[parent[x]]; x=parent[x]
        return x
    edges=0
    for i in range(n):
        for c in range(k):
            if tops[i,c]<tau: continue
            j=int(topk[i,c])
            if mutual and i not in nbr[j]: continue
            ri,rj=find(i),find(j)
            if ri!=rj: parent[ri]=rj; edges+=1
    remap={}; assign=np.empty(n,dtype=np.int32)
    for i in range(n):
        r=find(i)
        if r not in remap: remap[r]=len(remap)
        assign[i]=remap[r]
    return assign, len(remap), edges

def _relabel(assign):
    remap={}; out=np.empty(len(assign),dtype=np.int32)
    for i,a in enumerate(assign):
        a=int(a)
        if a not in remap: remap[a]=len(remap)
        out[i]=remap[a]
    return out, len(remap)

_CORE={}
def twopass(X, tau_core, tau_attach):
    """Pass 1: leader cores at tau_core (partitional — clusters never merge → no giant blob).
    Pass 2: attach each Noble singleton to its nearest CORE centroid if sim>=tau_attach. Cores
    stay fixed, so there is no transitive chaining; only isolated readings get absorbed."""
    if tau_core not in _CORE:
        a0,_=leader_cluster(X,tau_core); g0=group_of(a0)
        core_ids=[cid for cid,idx in g0.items() if len(idx)>=2]
        singles=[idx[0] for cid,idx in g0.items() if len(idx)==1]
        if core_ids and singles:
            C=np.vstack([(lambda m:m/(np.linalg.norm(m) or 1.0))(X[g0[c]].mean(0)) for c in core_ids]).astype(np.float32)
            sims=X[singles] @ C.T; best=sims.argmax(1); bestsim=sims.max(1)
        else:
            best=np.zeros(len(singles),dtype=int); bestsim=np.zeros(len(singles),dtype=np.float32)
        _CORE[tau_core]=(a0,core_ids,singles,best,bestsim)
        print(f"    cores(tau_core={tau_core})={len(core_ids)}  singletons={len(singles)}")
    a0,core_ids,singles,best,bestsim=_CORE[tau_core]
    assign=a0.copy(); absorbed=0
    for n_i,i in enumerate(singles):
        if core_ids and bestsim[n_i]>=tau_attach:
            assign[i]=core_ids[int(best[n_i])]; absorbed+=1
    out,ncl=_relabel(assign)
    print(f"    attach tau={tau_attach:.2f}  absorbed {absorbed}/{len(singles)} singletons  clusters={ncl}")
    return out, ncl

_GRAPH=None
def do_cluster(X, tau):
    """twopass(default): cores + edge-absorb (no blob, fewer Noble). knn: mutual kNN union-find
    (blobs — diagnostic only). leader: greedy single-leader."""
    global _GRAPH
    if METHOD=="twopass": return twopass(X,TAUCORE,tau)
    if METHOD=="leader":  return leader_cluster(X,tau)
    if _GRAPH is None: _GRAPH=knn_graph(X,KNN_K)
    assign,ncl,edges=union_from_graph(_GRAPH,tau,MUTUAL)
    print(f"    union tau={tau:.2f}  edges={edges}  clusters={ncl}  (k={KNN_K} mutual={MUTUAL})")
    return assign, ncl

def build_matrix(rows):
    raw=np.vstack([to_vec(r["embedding"]) for r in rows]).astype(np.float32)
    raw=np.nan_to_num(raw,nan=0.0,posinf=0.0,neginf=0.0)
    norms=np.linalg.norm(raw,axis=1,keepdims=True)
    good=norms[:,0]>1e-6                                       # rows with a real embedding
    norms[norms[:,0]==0]=1.0
    return (raw/norms).astype(np.float32), good

BAND_ORDER=["Noble (1)","Fresh (2-3)","Emerging (4-8)","Established (9-25)","Cliché (26-70)","Giant (>70)"]
def band(n):
    return ("Noble (1)" if n==1 else "Fresh (2-3)" if n<=3 else "Emerging (4-8)" if n<=8
            else "Established (9-25)" if n<=25 else "Cliché (26-70)" if n<=70 else "Giant (>70)")
def group_of(assign):
    groups={}
    for i,a in enumerate(assign): groups.setdefault(int(a),[]).append(i)
    return groups
def cohesion_of(groups,X):
    coh={}
    for cid,idx in groups.items():
        if len(idx)==1: coh[cid]=1.0; continue
        sub=X[idx]; c=sub.mean(axis=0); n=np.linalg.norm(c); c=c/(n if n else 1.0)
        coh[cid]=float((sub @ c).mean())
    return coh

# ===================== STAGE 2: critic gate + naming =====================
def call_llm(system,user,max_tokens=1200):
    if not ANT: sys.exit("Missing ANTHROPIC_API_KEY (needed for the gate stage).")
    body={"model":GATE_MODEL,"max_tokens":max_tokens,"system":system,"messages":[{"role":"user","content":user}]}
    for a in range(8):
        st,tx=http("POST","https://api.anthropic.com/v1/messages",
                   {"x-api-key":ANT,"anthropic-version":"2023-06-01"},body,timeout=180)
        if st==200:
            obj=json.loads(tx); return "".join(p.get("text","") for p in obj.get("content",[]) if p.get("type")=="text")
        if st in (429,500,502,503,520,529) and a<7: time.sleep(min(60,5*(a+1))); continue
        raise RuntimeError(f"llm {st}: {tx[:200]}")
def parse_json(s):
    s=(s or "").strip()
    if s.startswith("```"): s=re.sub(r"^```[a-z]*\n?","",s); s=re.sub(r"\n?```$","",s)
    i=s.find("{"); j=s.rfind("}")
    if i>=0 and j>i: s=s[i:j+1]
    return json.loads(s)

SYS_GATE=("You are the chief film critic of Metatake. You are handed a CLUSTER of bold film readings "
  "(\"Strong Misreadings\" — each a one-line headline + its film) that an embedding model grouped as similar. "
  "Your job is criticism, not classification.\n\n"
  "A TROPE is a semiotically-loaded CODE: a recurring interpretive move or device that carries a MEANING and an "
  "activated EXPECTATION. (Thompson's strikingness: 'the cruel stepmother is a motif; the mother is not.' Bloom: a "
  "strong misreading, once it recurs, becomes a trope.) A bare attribute, a vague theme, or a grab-bag is NOT a trope.\n\n"
  "Do three things:\n"
  "1) Judge: is this cluster ONE code, SEVERAL codes, or NOT a code (incoherent / bare)?\n"
  "2) For each genuine code, write an evocative ≤8-word Title-Case NAME that STATES THE CODE — 'The City Filmed in "
  "Disguise', 'The One Who Refused the Order', never 'Location Readings' or 'Films About Time'. Add a laconic (≤14 "
  "words) and a 1–2 sentence note. List the member indices that belong; DROP indices that don't (they stand alone).\n"
  "3) Do NOT force a split to hit a number, and do NOT glue unrelated readings together. Split only when the cluster "
  "truly holds more than one code. Naming is the point — make each name feel like an uncannily perfect set was gathered.\n\n"
  'Return ONLY JSON: {"verdict":"code|multi|reject","groups":[{"name":"...","laconic":"...","note":"...","members":[<indices>]}]}. '
  "For reject, use groups:[].")

def fetch_take_meta(ids):
    out={}
    sel="id,take_title,framework,figure:figures!inner(label,film:films!inner(title,year))"
    for i in range(0,len(ids),150):
        chunk=ids[i:i+150]
        st,tx=sb("GET",f"takes?select={sel}&id=in.({','.join(chunk)})&limit=150")
        if st!=200: raise RuntimeError(f"meta {st}: {tx[:160]}")
        for t in json.loads(tx):
            fig=t.get("figure") or {}; film=fig.get("film") or {}
            out[t["id"]]={"t":t.get("take_title") or fig.get("label") or "?","fw":t.get("framework") or "",
                          "film":f"{film.get('title','?')} ({film.get('year','')})".strip()}
    return out

def gate_prompt(members):
    lines=[f'[{i}] {m["t"]} — {m["film"]}' for i,m in enumerate(members)]
    return "Cluster of bold readings that an embedding grouped together:\n"+"\n".join(lines)+"\n\nReturn the JSON."

def gate_stage():
    if not os.path.exists(CLUSTERS_JSON): sys.exit(f"No {os.path.basename(CLUSTERS_JSON)} — run the cluster stage first.")
    data=json.load(open(CLUSTERS_JSON,encoding="utf-8"))
    multi=[c for c in data["clusters"] if c["size"]>1]
    multi.sort(key=lambda c:-c["size"])
    random.seed(7)
    def band_pick(lo,hi,n):
        pool=[c for c in multi if lo<=c["size"]<=hi]; random.shuffle(pool); return pool[:n]
    picks = multi[:4] + band_pick(9,25,6) + band_pick(4,8,8) + band_pick(2,3,6)
    seen=set(); uniq=[]
    for c in picks:
        key=tuple(c["members"][:2])
        if key in seen: continue
        seen.add(key); uniq.append(c)
    uniq=uniq[:PILOT]
    print(f"[gate-pilot] {len(uniq)} clusters · model={GATE_MODEL}")
    allids=[mid for c in uniq for mid in c["members"][:15]]
    meta=fetch_take_meta(list(set(allids)))
    for ci,c in enumerate(uniq,1):
        mem=[meta[mid] for mid in c["members"][:15] if mid in meta]
        if not mem: continue
        try: out=parse_json(call_llm(SYS_GATE,gate_prompt(mem)))
        except Exception as e: print(f"\n[{ci}] size {c['size']} coh {c['cohesion']}  ! {e}"); continue
        print(f"\n[{ci}] cluster size {c['size']} · cohesion {c['cohesion']} · verdict {out.get('verdict')}")
        for g in out.get("groups",[]):
            idxs=g.get("members",[])
            print(f"    ▸ \"{g.get('name')}\"  ({len(idxs)}/{len(mem)})  — {g.get('laconic','')}")
            for k in idxs[:3]:
                if isinstance(k,int) and 0<=k<len(mem): print(f"        · {mem[k]['t']} — {mem[k]['film']}")
        if out.get("verdict")=="reject": print("    (rejected — bare/incoherent; members would stand alone as Noble)")
    print("\n✅ gate pilot done. Review the NAMES. If good, we build the full batch gate over all 3,610 clusters.")

# ---- big-cluster split (cohesion-based, so naming stays focused) ----
def _kmeans(V,k,iters=12,seed=1):
    n=len(V); k=max(2,min(k,n)); rng=random.Random(seed)
    cent=[V[rng.randrange(n)]]
    while len(cent)<k:
        d=[min(1-float(np.dot(v,c)) for c in cent) for v in V]; tot=sum(d) or 1.0
        r=rng.random()*tot; acc=0; pick=n-1
        for i,dd in enumerate(d):
            acc+=dd
            if acc>=r: pick=i; break
        cent.append(V[pick])
    cent=np.array(cent,dtype=np.float32); assign=np.zeros(n,dtype=np.int32)
    for _ in range(iters):
        assign=(V@cent.T).argmax(1)
        for ci in range(k):
            mem=V[assign==ci]
            if len(mem): c=mem.mean(0); nn=np.linalg.norm(c); cent[ci]=c/(nn if nn else 1.0)
    return assign

REQ_JSONL=os.path.join(HERE,"trope-gate-requests.jsonl")
MAP_JSON=os.path.join(HERE,"trope-gate-map.json")
RES_JSONL=os.path.join(HERE,"trope-gate-results.jsonl")

def _rows_matrix():
    rows=load_takes(); np.seterr(all="ignore"); X,good=build_matrix(rows)
    rows=[r for r,g in zip(rows,good) if g]; X=X[good]
    return rows, X, {r["id"]:i for i,r in enumerate(rows)}
def _meta(r):
    fig=r.get("figure") or {}; film=fig.get("film") or {}
    return {"t":r.get("take_title") or fig.get("label") or "?","film":f"{film.get('title','?')} ({film.get('year','')})".strip()}
def _filmslug(r):
    return ((r.get("figure") or {}).get("film") or {}).get("slug")

def emit_stage():
    if not os.path.exists(CLUSTERS_JSON): sys.exit("run the cluster stage first.")
    clusters=[c for c in json.load(open(CLUSTERS_JSON,encoding="utf-8"))["clusters"] if c["size"]>1]
    rows,X,idx=_rows_matrix()
    reqs=[]; cmap={}; cid=0; noble=0; nbig=0
    for c in clusters:
        mem=[idx[m] for m in c["members"] if m in idx]
        if len(mem)<2: noble+=len(mem); continue
        if len(mem)<=BIGSPLIT: subs=[mem]
        else:
            nbig+=1; k=math.ceil(len(mem)/18); asg=_kmeans(X[mem],k)
            subs=[[mem[j] for j in range(len(mem)) if asg[j]==g] for g in range(k)]
        for sub in subs:
            if len(sub)<2: noble+=len(sub); continue
            cid+=1; key=f"c{cid}"
            ms=[_meta(rows[i]) for i in sub]
            reqs.append({"custom_id":key,"params":{"model":GATE_MODEL,"max_tokens":min(4000,500+len(sub)*60),
                "system":SYS_GATE,"messages":[{"role":"user","content":gate_prompt(ms)}]}})
            cmap[key]=[rows[i]["id"] for i in sub]
    json.dump(cmap,open(MAP_JSON,"w"))
    with open(REQ_JSONL,"w",encoding="utf-8") as f:
        for r in reqs: f.write(json.dumps(r,ensure_ascii=False)+"\n")
    ain=sum(len(r["params"]["messages"][0]["content"])//4+260 for r in reqs)
    est=ain/1e6*5*0.5 + len(reqs)*260/1e6*25*0.5
    print(f"[emit] requests={len(reqs)}  (big clusters pre-split={nbig})  takes→Noble (size<2 subs)={noble}")
    print(f"  est. batch cost ≈ ${est:,.2f} (Opus, 50%)")
    print(f"  wrote {os.path.basename(REQ_JSONL)} + {os.path.basename(MAP_JSON)}.  Next: submit.")

def _maturity(films,coh):
    if films<=1: return "noble"
    if films<=3: return "fresh" if coh>=0.70 else "emerging"
    if films<=8: return "emerging"
    if films<=25: return "established"
    return "cliche"
def _slugify(s):
    s=re.sub(r"<[^>]+>","",s or "").lower(); s=re.sub(r"[^a-z0-9]+","-",s).strip("-"); return s[:72] or "trope"

def finalize_stage():
    if not (os.path.exists(RES_JSONL) and os.path.exists(MAP_JSON)): sys.exit("need results + map (run fetch first).")
    cmap=json.load(open(MAP_JSON,encoding="utf-8"))
    rows,X,idx=_rows_matrix()
    fslug={r["id"]:_filmslug(r) for r in rows}
    tropes=[]; noble=set(); rej=0; seen_cid=set()
    for line in open(RES_JSONL,encoding="utf-8"):
        line=line.strip()
        if not line: continue
        o=json.loads(line); cid=o.get("custom_id")
        if not cid or cid in seen_cid: continue
        seen_cid.add(cid); ids=cmap.get(cid)
        if not ids: continue
        try: parsed=parse_json(o.get("text") or "{}")
        except Exception: rej+=1; noble.update(ids); continue
        groups=[] if parsed.get("verdict")=="reject" else parsed.get("groups",[])
        claimed=set()
        for g in groups:
            mem=list(dict.fromkeys(ids[i] for i in g.get("members",[]) if isinstance(i,int) and 0<=i<len(ids)))
            films={fslug.get(t) for t in mem if fslug.get(t)}
            if len(mem)<2 or len(films)<2: continue           # need >=2 takes AND >=2 distinct films
            claimed.update(mem)
            sub=X[[idx[t] for t in mem]]; c=sub.mean(0); nn=np.linalg.norm(c)
            coh=float((sub@(c/(nn or 1.0))).mean())
            tropes.append({"name":(g.get("name") or "").strip(),"laconic":g.get("laconic"),"note":g.get("note"),
                           "members":mem,"films":len(films),"cohesion":round(coh,3)})
        noble.update(t for t in ids if t not in claimed)
    usedslug=set()
    for t in tropes:
        t["maturity"]=_maturity(t["films"],t["cohesion"]); t["trope_kind"]="misreading"
        b=_slugify(t["name"]); s=b; n=2
        while s in usedslug: s=f"{b}-{n}"; n+=1
        usedslug.add(s); t["slug"]=s
    from collections import Counter
    bc=Counter(t["maturity"] for t in tropes)
    json.dump({"tropes":tropes,"noble_take_ids":sorted(noble)},open(PLAN_JSON,"w"),ensure_ascii=False)
    print(f"[finalize] tropes={len(tropes)}  noble takes={len(noble)}  parse-rej={rej}")
    print("  maturity:", {k:bc.get(k,0) for k in ['fresh','emerging','established','cliche']})
    print(f"  takes inside tropes={sum(len(t['members']) for t in tropes)}")
    print(f"  wrote {os.path.basename(PLAN_JSON)}.  Sample (largest):")
    for t in sorted(tropes,key=lambda x:-len(x['members']))[:20]:
        print(f"   [{len(t['members'])}t/{t['films']}f {t['maturity']} coh{t['cohesion']}] {t['name']}")

# ===================== STAGE 4: global harmonize (content-aware) =====================
SYS_HARM=("You are the chief film critic of Metatake, harmonizing a trope taxonomy. You are given a small "
  "FAMILY of tropes that an embedding finds near-identical IN MEANING. Each trope has a name, a laconic, a NOTE "
  "explaining its CODE, and a few sample readings. Judge by the CODE, not the wording of the name:\n"
  "- MERGE tropes that are truly the SAME code into one group, and give that group the single best ≤8-word "
  "Title-Case name + a laconic (≤14 words).\n"
  "- KEEP SEPARATE tropes whose codes genuinely differ even when worded alike (same surface, different "
  "meaning/expectation → different tropes). When in doubt, keep separate — do NOT over-merge.\n"
  "Every input index must appear in exactly one group; a one-member group means 'kept as itself'.\n"
  'Return ONLY JSON: {"groups":[{"name":"...","laconic":"...","members":[<indices>]}]}.')

def _trope_stats(members, X, idx, fslug):
    mem=[idx[m] for m in members if m in idx]
    films={fslug.get(m) for m in members if fslug.get(m)}
    if mem:
        sub=X[mem]; c=sub.mean(0); nn=np.linalg.norm(c); cen=c/(nn or 1.0)
        coh=float((sub@cen).mean())
    else: coh=0.0; cen=np.zeros(X.shape[1],dtype=np.float32)
    return len(films), round(coh,3), cen.astype(np.float32)

def harmonize_stage():
    if not os.path.exists(PLAN_JSON): sys.exit("need trope-plan.json (run finalize first).")
    plan=json.load(open(PLAN_JSON,encoding="utf-8")); tropes=plan["tropes"]; noble=plan.get("noble_take_ids",[])
    rows,X,idx=_rows_matrix()
    fslug={r["id"]:_filmslug(r) for r in rows}; meta={r["id"]:_meta(r) for r in rows}
    C=np.zeros((len(tropes),X.shape[1]),dtype=np.float32)
    for ti,t in enumerate(tropes): _,_,C[ti]=_trope_stats(t["members"],X,idx,fslug)
    graph=knn_graph(C,min(SIMK,max(1,len(tropes)-1)))
    assign,_,_=union_from_graph(graph,HARM_MERGE,mutual=False)
    fam={}
    for ti,a in enumerate(assign): fam.setdefault(int(a),[]).append(ti)
    fams=[v for v in fam.values() if len(v)>1]
    print(f"[harmonize] tropes={len(tropes)}  merge-families(≥{HARM_MERGE})={len(fams)}  covering {sum(len(f) for f in fams)} tropes")
    cache={}
    if os.path.exists(HARM_CACHE):
        for l in open(HARM_CACHE,encoding="utf-8"):
            try: o=json.loads(l); cache[o["key"]]=o["groups"]
            except Exception: pass
    cfh=open(HARM_CACHE,"a",encoding="utf-8")
    survivor_of={}; rename={}
    for fi,members in enumerate(fams,1):
        key="-".join(map(str,sorted(members))); groups=cache.get(key)
        if groups is None:
            lines=[]
            for j,ti in enumerate(members):
                t=tropes[ti]; samp="; ".join(meta[m]["t"] for m in t["members"][:3] if m in meta)
                lines.append(f'[{j}] "{t["name"]}" — {t.get("laconic") or ""}\n    note: {t.get("note") or ""}\n    e.g.: {samp}')
            try:
                groups=parse_json(call_llm(SYS_HARM,"A family of possibly-duplicate tropes:\n\n"+"\n\n".join(lines)+"\n\nReturn the JSON.",max_tokens=1100)).get("groups",[])
            except Exception as e:
                print(f"  ! family {fi} {e}"); groups=[{"members":[j]} for j in range(len(members))]
            cfh.write(json.dumps({"key":key,"groups":groups},ensure_ascii=False)+"\n"); cfh.flush()
        for g in groups:
            gm=g.get("members",[]) if isinstance(g,dict) else g
            gi=[members[k] for k in gm if isinstance(k,int) and 0<=k<len(members)]
            if len(gi)<=1: continue
            surv=max(gi,key=lambda ti:len(tropes[ti]["members"]))
            if isinstance(g,dict) and g.get("name"): rename[surv]=(g["name"],g.get("laconic") or tropes[surv].get("laconic"))
            for ti in gi:
                if ti!=surv: survivor_of[ti]=surv
        if fi%25==0: print(f"  …{fi}/{len(fams)} families")
    cfh.close()
    def root(ti):
        while ti in survivor_of: ti=survivor_of[ti]
        return ti
    groups={}
    for ti in range(len(tropes)): groups.setdefault(root(ti),[]).append(ti)
    out=[]
    for r,grp in groups.items():
        members=[]
        for ti in grp: members+=tropes[ti]["members"]
        members=list(dict.fromkeys(members)); base=tropes[r]
        nm,lac=rename.get(r,(base["name"],base.get("laconic")))
        films,coh,_=_trope_stats(members,X,idx,fslug)
        out.append({"name":nm,"laconic":lac,"note":base.get("note"),"members":members,
                    "films":films,"cohesion":coh,"maturity":_maturity(films,coh),"trope_kind":"misreading"})
    usedslug=set()
    for t in out:
        b=_slugify(t["name"]); s=b; n=2
        while s in usedslug: s=f"{b}-{n}"; n+=1
        usedslug.add(s); t["slug"]=s
    C2=np.zeros((len(out),X.shape[1]),dtype=np.float32)
    for ti,t in enumerate(out): _,_,C2[ti]=_trope_stats(t["members"],X,idx,fslug)
    tk,ts,_=knn_graph(C2,min(SIMK,max(1,len(out)-1)))
    edges=[]; seen=set()
    for i in range(len(out)):
        for c in range(tk.shape[1]):
            j=int(tk[i,c]); sim=float(ts[i,c])
            if j<0 or sim<HARM_SIM: continue
            a,b=sorted((i,j))
            if (a,b) in seen: continue
            seen.add((a,b)); edges.append({"a":out[a]["slug"],"b":out[b]["slug"],"sim":round(sim,3)})
    from collections import Counter
    bc=Counter(t["maturity"] for t in out)
    json.dump({"tropes":out,"noble_take_ids":noble,"similar_edges":edges},open(PLAN_H_JSON,"w"),ensure_ascii=False)
    print(f"[harmonize] merged {len(tropes)-len(out)} → final tropes {len(out)}  · similar-edges {len(edges)}")
    print("  maturity:", {k:bc.get(k,0) for k in ['fresh','emerging','established','cliche']})
    print(f"  wrote {os.path.basename(PLAN_H_JSON)}.  Largest:")
    for t in sorted(out,key=lambda x:-len(x['members']))[:15]:
        print(f"   [{len(t['members'])}t/{t['films']}f {t['maturity']}] {t['name']}")

def main():
    if STAGE=="gate": return gate_stage()
    if STAGE=="emit": return emit_stage()
    if STAGE=="finalize": return finalize_stage()
    if STAGE=="harmonize": return harmonize_stage()
    if STAGE not in ("cluster","sweep"):
        sys.exit(f"stage '{STAGE}' not built yet (this file implements: cluster, sweep, gate).")
    rows=load_takes()
    if not rows: sys.exit("No embedded takes — run embeddings first (run-sm-embed.command).")
    np.seterr(all="ignore")                                   # silence cosmetic BLAS warnings
    X,good=build_matrix(rows)
    nbad=int((~good).sum())
    if nbad:
        print(f"[matrix] dropping {nbad} takes with empty/bad embeddings")
        rows=[r for r,g in zip(rows,good) if g]; X=X[good]
    print(f"[matrix] {X.shape}")

    if STAGE=="sweep":
        from collections import Counter
        extra=(f', tau_core={TAUCORE}' if METHOD=='twopass' else
               (', mutual='+str(MUTUAL)+', k='+str(KNN_K) if METHOD=='knn' else ''))
        note=" [sweep value = tau_attach]" if METHOD=="twopass" else ""
        print(f"\n===== TAU SWEEP (method={METHOD}{extra}){note} =====")
        for tau in SWEEP:
            assign,nL=do_cluster(X,tau)
            groups=group_of(assign); coh=cohesion_of(groups,X)
            sizes=np.array([len(v) for v in groups.values()])
            bc=Counter(band(n) for n in sizes)
            mc=np.array([coh[c] for c in groups if len(groups[c])>1] or [0.0])
            print(f"\ntau={tau:.2f}  clusters={len(groups)}  Noble={int((sizes==1).sum())}  "
                  f"multi={int((sizes>1).sum())}  cohesion med={np.median(mc):.2f} mean={mc.mean():.2f}")
            print("   "+" · ".join(f"{b.split(' ')[0]} {bc.get(b,0)}" for b in BAND_ORDER)
                  +f"  | top sizes {sorted((int(s) for s in sizes),reverse=True)[:6]}")
        print("\n✅ sweep done. Tell Claude the table; we pick tau, then run `cluster --tau X`.")
        return

    # ---- cluster stage: detailed preview + write json for the gate ----
    print(f"[cluster] method={METHOD} tau={TAU}")
    assign,nL=do_cluster(X,TAU)
    groups=group_of(assign); cohesion=cohesion_of(groups,X)
    sizes=np.array([len(v) for v in groups.values()])
    from collections import Counter
    bc=Counter(band(n) for n in sizes)
    print("\n===== CANDIDATE CLUSTERS (DRY, no LLM) =====")
    print(f"takes={len(rows)}  clusters={len(groups)}  leaders={nL}  tau={TAU}")
    print(f"singletons (Noble)={int((sizes==1).sum())}  multi={int((sizes>1).sum())}  "
          f"in-multi takes={int(sizes[sizes>1].sum())}")
    print("maturity bands:")
    for b in BAND_ORDER: print(f"   {bc.get(b,0):>5}  {b}")
    multicoh=[cohesion[c] for c in groups if len(groups[c])>1]
    if multicoh:
        mc=np.array(multicoh)
        print(f"cohesion (multi-member): min {mc.min():.2f}  median {np.median(mc):.2f}  mean {mc.mean():.2f}  max {mc.max():.2f}")

    def lab(i):
        r=rows[i]; fig=r.get("figure") or {}; film=(fig.get("film") or {})
        return f"{r.get('take_title') or fig.get('label') or '?'}  · {film.get('title','?')} ({film.get('year','')})"
    big=sorted((c for c in groups if len(groups[c])>1), key=lambda c:-len(groups[c]))
    print(f"\n--- top {min(SHOW,len(big))} clusters by size (eyeball coherence + naming) ---")
    for c in big[:SHOW]:
        idx=groups[c]
        print(f"\n[{len(idx)} · coh {cohesion[c]:.2f}]")
        for i in idx[:SAMPLES]: print(f"   - {lab(i)}")
        if len(idx)>SAMPLES: print(f"   … +{len(idx)-SAMPLES} more")
    # a few mid-size (the discovery sweet spot)
    mids=[c for c in groups if 3<=len(groups[c])<=8]
    import random as _r; _r.seed(1); _r.shuffle(mids)
    print(f"\n--- {min(12,len(mids))} sample mid-size clusters (Emerging — the discoveries) ---")
    for c in mids[:12]:
        idx=groups[c]
        print(f"\n[{len(idx)} · coh {cohesion[c]:.2f}]")
        for i in idx[:SAMPLES]: print(f"   - {lab(i)}")

    # persist candidates for the gate stage (deterministic)
    out={"tau":TAU,"take_ids":[r["id"] for r in rows],
         "clusters":[{"members":[rows[i]["id"] for i in groups[c]],
                      "size":len(groups[c]),"cohesion":round(cohesion[c],4)} for c in groups]}
    json.dump(out, open(CLUSTERS_JSON,"w"), ensure_ascii=False)
    print(f"\n✅ wrote {os.path.basename(CLUSTERS_JSON)} ({len(groups)} clusters). "
          f"Tune --tau and re-run; when happy, the gate stage consumes this file.")

if __name__=="__main__": main()
