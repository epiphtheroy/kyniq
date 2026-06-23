#!/usr/bin/env python3
"""trope-consolidate — fold the 935 reading meta-takes into the figure_type TROPE
layer (quality-first), then dedup the whole trope layer. DRY by default: NO DB writes.

Why this shape: readings are trope-like. We (1) embed both layers in one space,
(2) match each reading to the nearest existing trope — near-duplicates MERGE into
that trope, genuinely-new patterns are PROMOTED to new tropes (a clean trope-style
name, members = the reading's figures), (3) dedup the unified trope layer. Reading
duplicates (e.g. two "Performing Emotional Control") resolve automatically in step 3
— so the paused reading-dedup is subsumed here (single cutover, no double churn).

Layers (meta_takes table):
  reading      -> /take/[slug]    (935 published, embedded)   ... folded away
  figure_type  -> /trope/[slug]   (1,299 published, NO emb)   ... the survivor layer
  figure_type_members(meta_take_id, figure_id, sim)           ... trope -> figures
  takes(meta_take_id, figure_id)                              ... reading -> figures

Usage:
  python3 trope-consolidate.py                 # DRY: full plan -> .md + .json + cost
  python3 trope-consolidate.py --limit 120     # DRY on first N readings (quick test)
  python3 trope-consolidate.py --persist       # APPLY the plan (writes DB)
Opts: --model claude-opus-4-8  --auto-merge 0.86  --auto-new 0.70  --trope-dup 0.90
"""
import os, sys, json, re, time, math, hashlib, urllib.request, urllib.error
from collections import defaultdict
try:
    import numpy as np
except Exception:
    sys.exit("numpy required:  pip3 install --break-system-packages numpy")

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
OPENAI=os.environ.get("OPENAI_API_KEY"); ANT=os.environ.get("ANTHROPIC_API_KEY")
args=sys.argv[1:]
PERSIST="--persist" in args
def argf(f,d): return type(d)(args[args.index(f)+1]) if f in args else d
LIMIT=argf("--limit",0)
AUTO_MERGE=argf("--auto-merge",0.90); AUTO_NEW=argf("--auto-new",0.45); TROPE_DUP=argf("--trope-dup",0.84)
MODEL=args[args.index("--model")+1] if "--model" in args else "claude-opus-4-8"
OUT=args[args.index("--out")+1] if "--out" in args else "trope-consolidate-dry"
EMB_MODEL="text-embedding-3-small"
PRICE_IN,PRICE_OUT=5.0,25.0
if not (URL and KEY and ANT and OPENAI): sys.exit("Missing env (SUPABASE URL+SERVICE_ROLE_KEY + ANTHROPIC_API_KEY + OPENAI_API_KEY)")

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
TIN=[0]; TOUT=[0]
def call_llm(system,user,max_tokens=3000):
    body={"model":MODEL,"max_tokens":max_tokens,"system":system,"messages":[{"role":"user","content":user}]}
    for a in range(8):
        st,tx=http("POST","https://api.anthropic.com/v1/messages",
                   {"x-api-key":ANT,"anthropic-version":"2023-06-01"},body)
        if st==200:
            o=json.loads(tx); u=o.get("usage",{}); TIN[0]+=u.get("input_tokens",0); TOUT[0]+=u.get("output_tokens",0)
            return "".join(p.get("text","") for p in o.get("content",[]) if p.get("type")=="text")
        if st in (429,500,502,503,520,529) and a<7: time.sleep(min(60,5*(a+1))); continue
        raise RuntimeError(f"llm {st}: {tx[:200]}")
def parse_json(s):
    s=s.strip()
    if s.startswith("```"): s=re.sub(r"^```[a-z]*\n?","",s); s=re.sub(r"\n?```$","",s)
    i=s.find("{"); j=s.rfind("}")
    if i>=0 and j>i: s=s[i:j+1]
    return json.loads(s)
def slugify(s):
    s=re.sub(r"<[^>]+>","",s or "").lower(); s=re.sub(r"[^a-z0-9]+","-",s).strip("-"); return s[:76] or "x"

# ---------- embeddings (cached) ----------
def emb_text(r): return f"{r.get('title','')}. {(r.get('laconic') or '')}".strip()[:1000]  # title+gloss: comparable across reading/trope
def embed_cached(rows, cache_path):
    cache={}
    if os.path.exists(cache_path):
        try: cache=json.load(open(cache_path))
        except Exception: cache={}
    need=[r for r in rows if r["id"] not in cache or cache[r["id"]].get("h")!=hashlib.md5(emb_text(r).encode()).hexdigest()]
    if need:
        print(f"  embedding {len(need)} ({os.path.basename(cache_path)}) …")
        texts=[emb_text(r) for r in need]
        for i in range(0,len(texts),128):
            chunk=[t or " " for t in texts[i:i+128]]
            for a in range(5):
                st,tx=http("POST","https://api.openai.com/v1/embeddings",{"Authorization":f"Bearer {OPENAI}"},
                           {"model":EMB_MODEL,"input":chunk})
                if st==200: break
                if a==4: raise RuntimeError(f"embed {st}: {tx[:200]}")
                time.sleep(2*(a+1))
            data=sorted(json.loads(tx)["data"],key=lambda d:d["index"])
            for r,d in zip(need[i:i+128],data):
                cache[r["id"]]={"h":hashlib.md5(emb_text(r).encode()).hexdigest(),"e":d["embedding"]}
        json.dump(cache,open(cache_path,"w"))
    M=np.array([cache[r["id"]]["e"] for r in rows],dtype=np.float32)
    M=np.nan_to_num(M,nan=0.0,posinf=0.0,neginf=0.0)
    M/=(np.linalg.norm(M,axis=1,keepdims=True)+1e-9)
    return M

# ---------- union-find ----------
def uf_find(p,x):
    p.setdefault(x,x)
    while p[x]!=x: p[x]=p[p[x]]; x=p[x]
    return x
def uf_union(p,a,b):
    ra,rb=uf_find(p,a),uf_find(p,b)
    if ra!=rb: p[ra]=rb

# ---------- LLM prompts ----------
SYS_MATCH=("You are FilmCurio's taxonomy editor. TROPES are recurring figure-shapes, devices, or motifs in "
 "cinema (e.g. 'The Voice From Nowhere' = offscreen/unseen sound; 'The Object Everyone Hunts' = a MacGuffin). "
 "We are folding former 'readings' into the trope layer. For EACH reading (its name, gloss, and a few sample "
 "figures it groups) plus a short list of CANDIDATE existing tropes (name + gloss), decide: does the reading "
 "name the SAME recurring pattern as one candidate (-> 'merge' into it), or a DISTINCT recurring pattern not in "
 "the list (-> 'new')? Prefer 'merge' when it is essentially the same device/figure/motif. Choose 'new' only for "
 "a genuinely distinct recurring pattern; then propose a trope-style Title Case name (a recurring figure/device, "
 "NOT an interpretation) and a <=14-word gloss. Return ONLY JSON: "
 '{"decisions":[{"i":<reading index>,"decision":"merge"|"new","trope":<candidate index or null>,'
 '"title":<new trope title or null>,"laconic":<new gloss or null>}]}')
def decide_matches(batch):
    # batch: list of {idx, title, laconic, figs:[..], cands:[(ci,title,laconic),..]}
    lines=["Decide merge-or-new for each reading:\n"]
    for b in batch:
        lines.append(f'[reading i={b["idx"]}] "{b["title"]}" — {b.get("laconic") or ""}')
        if b.get("figs"): lines.append("   sample figures: "+"; ".join(b["figs"][:5]))
        lines.append("   candidate tropes:")
        for ci,t,l in b["cands"]: lines.append(f'     [{ci}] "{t}" — {l or ""}')
        lines.append("")
    out=parse_json(call_llm(SYS_MATCH,"\n".join(lines),max_tokens=min(8000,800+len(batch)*220)))
    return {d["i"]:d for d in out.get("decisions",[]) if "i" in d}

SYS_TROPE=("You are FilmCurio's taxonomy editor. TROPES are recurring figure-shapes/devices/motifs (not "
 "interpretations). You are given several trope entries (name + gloss) that are near-duplicates by embedding. "
 "CLUSTER entries that name the SAME recurring pattern into one cluster (merge genuine duplicates and trivial "
 "rephrasings); keep two apart only when the pattern truly differs. Give each cluster ONE distinct Title Case "
 "name + a <=14-word gloss. Every input index must appear in exactly one cluster. Return ONLY JSON: "
 '{"clusters":[{"members":[<indices>],"title":"...","laconic":"..."}]}')
def cluster_tropes(entries):
    lines=["Cluster duplicate tropes, then name each cluster:\n"]
    for k,e in enumerate(entries): lines.append(f'[{k}] "{e["title"]}" — {e.get("laconic") or ""}')
    out=parse_json(call_llm(SYS_TROPE,"\n".join(lines),max_tokens=min(8000,600+len(entries)*120)))
    return out.get("clusters",[])

# ---------- sample figures for a reading (lazy) ----------
_figcache={}
def reading_figs(rid,n=5):
    if rid in _figcache: return _figcache[rid]
    st,tx=sb("GET",f"takes?select=figure:figures(label)&meta_take_id=eq.{rid}&order=confidence.desc&limit={n}")
    out=[]
    if st==200:
        for t in json.loads(tx):
            lab=((t.get("figure") or {}).get("label") or "").strip()
            if lab: out.append(lab)
    _figcache[rid]=out; return out

def main():
    mode="PERSIST" if PERSIST else "DRY"
    print(f"[trope-consolidate] model={MODEL} mode={mode}  auto_merge>={AUTO_MERGE} auto_new<={AUTO_NEW} trope_dup>={TROPE_DUP}")
    readings=fetch_all("meta_takes?select=id,slug,title,laconic,thesis,raw_concept,created_at&kind=eq.reading&status=eq.published")
    tropes=fetch_all("meta_takes?select=id,slug,title,laconic,thesis&kind=eq.figure_type&status=eq.published")
    fc={r["meta_take_id"]:r["film_count"] for r in fetch_all("meta_take_film_counts?select=meta_take_id,film_count")}
    tc={r["id"]:r["n"] for r in rpc("reading_hub_take_counts")}
    for r in readings: r["films"]=fc.get(r["id"],0); r["takes"]=tc.get(r["id"],0)
    tcnt={r["meta_take_id"]:(r.get("figures") or 0, r.get("films") or 0) for r in fetch_all("trope_counts?select=meta_take_id,figures,films")}
    for t in tropes: t["figures"],t["tfilms"]=tcnt.get(t["id"],(0,0))
    if LIMIT: readings=sorted(readings,key=lambda r:-r["films"])[:LIMIT]
    print(f"  readings={len(readings)}  tropes={len(tropes)}")

    R=embed_cached(readings,os.path.join(HERE,"reading-emb-cache.json"))
    T=embed_cached(tropes,os.path.join(HERE,"trope-emb-cache.json"))

    # ---------- collapse exact-duplicate readings by title (841/935 are dup rows) ----------
    groups=defaultdict(list)
    for i,r in enumerate(readings): groups[re.sub(r"\s+"," ",(r["title"] or "").strip().lower())].append(i)
    glist=list(groups.values())
    for g in glist: g.sort(key=lambda i:-readings[i]["films"])
    reps=[g[0] for g in glist]
    print(f"  distinct reading concepts (by title): {len(reps)}  (from {len(readings)} rows)")

    # ---------- PHASE: match each concept -> trope ----------
    S=R@T.T                                   # n_read x n_trope cosine
    auto_m=auto_n=0; pending=[]; match_rep={}   # rep_idx -> ("merge",trope_idx) | ("new",spec|None)
    for i in reps:
        order=np.argsort(-S[i]); j=int(order[0]); smax=float(S[i,j])
        if smax>=AUTO_MERGE: match_rep[i]=("merge",j); auto_m+=1
        elif smax<=AUTO_NEW: match_rep[i]=("new",None); auto_n+=1
        else:
            cands=[(int(c),tropes[int(c)]["title"],tropes[int(c)]["laconic"]) for c in order[:5]]
            pending.append({"idx":i,"title":readings[i]["title"],"laconic":readings[i]["laconic"],
                            "figs":reading_figs(readings[i]["id"]),"cands":cands})
    llm_n=len(pending)
    print(f"  concept match bands: auto-merge={auto_m}  llm={llm_n}  auto-new={auto_n}")
    for b0 in range(0,len(pending),6):
        chunk=pending[b0:b0+6]
        try: dec=decide_matches(chunk)
        except Exception as e: print(f"   ! match LLM error {e}"); dec={}
        for b in chunk:
            d=dec.get(b["idx"]); i=b["idx"]
            if d and d.get("decision")=="merge" and isinstance(d.get("trope"),int) and 0<=d["trope"]<len(tropes):
                match_rep[i]=("merge",d["trope"])
            else:
                spec=None
                if d and d.get("decision")=="new" and d.get("title"):
                    spec={"title":d["title"].strip()[:200],"laconic":(d.get("laconic") or readings[i]["laconic"])}
                match_rep[i]=("new",spec)
        print(f"   matched {min(b0+6,llm_n)}/{llm_n} concepts (LLM)")

    # ---------- build unified trope set (existing + promoted-new), expanding dup rows ----------
    uni=[]   # {key,title,laconic,emb,existing,tid,figures,src:[reading_idx]}
    for ti,t in enumerate(tropes):
        uni.append({"key":f"T{t['id']}","title":t["title"],"laconic":t["laconic"],"emb":T[ti],
                    "existing":True,"tid":t["id"],"figures":t["figures"],"src":[]})
    merges_to_existing=0; newkey_for={}   # rep_idx -> uni index
    for g in glist:
        rep=g[0]; kind,val=match_rep[rep]
        if kind=="merge":
            uni[val]["src"]+=g; merges_to_existing+=len(g)
        else:
            r=readings[rep]; title=(val or {}).get("title") or r["title"]
            uni.append({"key":f"N{r['id']}","title":title,"laconic":(val or {}).get("laconic") or r["laconic"],
                        "emb":R[rep],"existing":False,"tid":None,"figures":sum(readings[i]["takes"] for i in g),"src":list(g)})
            newkey_for[rep]=len(uni)-1
    keyidx={u["key"]:k for k,u in enumerate(uni)}
    n_new_raw=sum(1 for u in uni if not u["existing"])
    print(f"  reading outcomes: merge->existing rows={merges_to_existing}  promoted-new concepts(raw)={n_new_raw}")

    # ---------- PHASE: dedup the unified trope layer ----------
    U=np.array([u["emb"] for u in uni],dtype=np.float32)
    p={}
    bytitle=defaultdict(list)
    for k,u in enumerate(uni): bytitle[u["title"].strip().lower()].append(k)
    for ids in bytitle.values():
        for x in ids[1:]: uf_union(p,ids[0],x)
    SU=U@U.T
    n=len(uni)
    for a in range(n):
        nbr=np.argsort(-SU[a])[:8]
        for b in nbr:
            b=int(b)
            if b!=a and SU[a,b]>=TROPE_DUP: uf_union(p,a,b)
    comps=defaultdict(list)
    for k in range(n): comps[uf_find(p,k)].append(k)
    comps=[c for c in comps.values() if len(c)>1]
    comps.sort(key=lambda c:-len(c))
    print(f"  trope-dedup candidate components: {len(comps)} (covering {sum(len(c) for c in comps)} entries)")

    survivor_of={}      # uni_idx -> uni_idx (survivor)
    rename={}           # survivor uni_idx -> (title,laconic)
    def comp_chunks(c):
        if len(c)<=14: return [c]
        c=sorted(c,key=lambda k:-uni[k]["figures"]); return [c[i:i+12] for i in range(0,len(c),12)]
    done=0
    for c in comps:
        for ch in comp_chunks(c):
            entries=[{"title":uni[k]["title"],"laconic":uni[k]["laconic"]} for k in ch]
            try: cls=cluster_tropes(entries)
            except Exception as e: print(f"   ! trope-dedup LLM error {e}"); continue
            seen=set()
            for cl in cls:
                idxs=[ch[m] for m in (cl.get("members") or []) if isinstance(m,int) and 0<=m<len(ch) and ch[m] not in seen]
                if not idxs: continue
                seen.update(idxs)
                # survivor: prefer existing trope with most figures, else biggest
                idxs.sort(key=lambda k:(0 if uni[k]["existing"] else 1, -uni[k]["figures"]))
                surv=idxs[0]
                rename[surv]=(cl.get("title") or uni[surv]["title"], cl.get("laconic") or uni[surv]["laconic"])
                for k in idxs: survivor_of[k]=surv
                for k in idxs[1:]:
                    uni[surv]["src"]+=uni[k]["src"]
            done+=1
    def final(k):
        seen=set()
        while k in survivor_of and survivor_of[k]!=k and k not in seen: seen.add(k); k=survivor_of[k]
        return k

    # ---------- assemble final plan ----------
    surviving_new=[]   # uni entries (not existing) that survive dedup -> become new trope rows
    existing_merges=[] # (loser_tid, survivor_tid)
    for k,u in enumerate(uni):
        f=final(k)
        if f==k:
            if not u["existing"]: surviving_new.append(u)
        else:
            if u["existing"] and uni[f]["existing"]:
                existing_merges.append((u["tid"],uni[f]["tid"]))
    # reading -> final trope (existing tid or surviving-new key), expanded over dup rows
    reading_final={}
    for g in glist:
        rep=g[0]; kind,val=match_rep[rep]
        holder = val if kind=="merge" else newkey_for[rep]
        f=final(holder); tname=rename.get(f,(uni[f]["title"],uni[f]["laconic"]))[0]
        for i in g:
            reading_final[readings[i]["id"]]={"slug":readings[i]["slug"],"to_existing":uni[f]["tid"],
                "to_newkey":(None if uni[f]["existing"] else uni[f]["key"]),"to_title":tname}
    final_trope_count=sum(1 for k,u in enumerate(uni) if final(k)==k)
    print(f"\n  RESULT: trope layer {len(tropes)} + new {len(surviving_new)} − existing-merges {len(existing_merges)} = {final_trope_count} tropes")
    print(f"          readings folded: {len(reading_final)} (all -> a trope; /take/* will 301 -> /trope/*)")

    # ---------- report ----------
    md=[f"# Trope Consolidation — DRY\n_model {MODEL} · readings {len(readings)} → trope layer {len(tropes)}_\n"]
    md.append(f"## Result\n- final trope count: **{final_trope_count}** (was {len(tropes)}; +{len(surviving_new)} promoted, −{len(existing_merges)} dup-merges)\n"
              f"- readings folded away: **{len(reading_final)}** → each /take/[slug] 301 → /trope/[slug]\n"
              f"- reading match bands: auto-merge {auto_m} · LLM {llm_n} · auto-new {auto_n}\n"
              f"- reading outcomes: merge→existing {merges_to_existing} · promoted-new(raw) {n_new_raw} → after dedup {len(surviving_new)}\n")
    ex=[(readings[g[0]],tropes[match_rep[g[0]][1]]) for g in glist if match_rep[g[0]][0]=="merge"][:18]
    md.append("\n## Sample reading → existing trope (merge)\n")
    for r,t in ex: md.append(f"- \"{r['title']}\" ({r['films']}f) → **{t['title']}**")
    exist_idx=[k for k,u in enumerate(uni) if u["existing"]]
    EX=U[exist_idx] if exist_idx else None
    def nearest_existing(u):
        if EX is None: return ("",0.0)
        s=EX@U[keyidx[u["key"]]]; j=int(np.argmax(s)); return (uni[exist_idx[j]]["title"],float(s[j]))
    md.append("\n## Sample promoted NEW tropes (nearest existing trope shown — low sim ⇒ genuinely new)\n")
    for u in sorted(surviving_new,key=lambda u:-u["figures"])[:24]:
        nt,ns=nearest_existing(u)
        md.append(f"- **{rename.get(keyidx[u['key']],(u['title'],u['laconic']))[0]}** — {u['laconic'] or ''}  · ~{u['figures']} figs · nearest existing: \"{nt}\" ({ns:.2f})")
    md.append("\n## Sample trope ↔ trope merges (dedup of existing layer)\n")
    shown=0
    for lo,su in existing_merges[:18]:
        lot=next((x['title'] for x in tropes if x['id']==lo),lo); sut=next((x['title'] for x in tropes if x['id']==su),su)
        md.append(f"- \"{lot}\" → **{sut}**"); shown+=1
    if not shown: md.append("- (none)")
    cost=TIN[0]/1e6*PRICE_IN+TOUT[0]/1e6*PRICE_OUT
    md.append(f"\n---\n## Cost\n- tokens in {TIN[0]:,} · out {TOUT[0]:,}\n- est. cost this run: **${cost:,.2f}**\n")
    open(f"{OUT}.md","w",encoding="utf-8").write("\n".join(md))
    plan={"final_trope_count":final_trope_count,
          "surviving_new":[{"key":u["key"],"from_reading_id":u["key"][1:],
                            "title":rename.get(keyidx[u["key"]],(u["title"],u["laconic"]))[0],
                            "laconic":rename.get(keyidx[u["key"]],(u["title"],u["laconic"]))[1],
                            "src_reading_ids":[readings[i]["id"] for i in u["src"] if i<len(readings)]} for u in surviving_new],
          "existing_merges":[{"loser":lo,"survivor":su} for lo,su in existing_merges],
          "existing_renames":[{"tid":uni[k]["tid"],"title":rename[k][0],"laconic":rename[k][1]}
                              for k in rename if uni[k]["existing"]],
          "reading_final":reading_final}
    json.dump(plan,open(f"{OUT}.json","w",encoding="utf-8"),ensure_ascii=False,indent=2)
    print(f"\n est. cost ${cost:,.2f} · in {TIN[0]:,}/out {TOUT[0]:,}")
    print(f"✅ wrote {OUT}.md and {OUT}.json")
    if not PERSIST:
        print("  DRY — no DB writes. Review the .md, then we apply with --persist."); return
    print("  PERSIST requested — (apply step is gated; run only after DRY review).")

if __name__=="__main__": main()
