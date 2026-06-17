#!/usr/bin/env python3
"""trope-build (Tropes stage 2) — cluster type-tags into named trope hubs.

Stage 1 (trope-tag) gave each figure film-agnostic tags, but they're phrased
uniquely (~12k distinct, only ~30 recur by exact match). So we cluster them
SEMANTICALLY: embed distinct tags → union-find on near-synonym ANN pairs →
each cluster spanning >= GATE films becomes a trope (figure-type) hub, named
as a screenwriter craft category. Figures join via their tags (many-to-many).

Tags are already film-agnostic, so semantic clustering works (unlike raw figure
descriptions, which cluster by film).

DEFAULT IS DRY: embeds tags (one-time) + clusters + reports the tropes that would
form (no naming, no writes). Pass --persist to name (LLM) + create hubs + members.

Usage: python3 trope-build.py [--persist] [--thresh 0.60] [--gate 5] [--model claude-opus-4-8]
"""
import os, sys, json, re, time, urllib.request, urllib.error, urllib.parse
from collections import defaultdict, Counter

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p,encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
OPENAI=os.environ.get("OPENAI_API_KEY"); GEM=os.environ.get("GEMINI_API_KEY"); ANT=os.environ.get("ANTHROPIC_API_KEY")
args=sys.argv[1:]; PERSIST="--persist" in args
def argf(f,d): return type(d)(args[args.index(f)+1]) if f in args else d
THRESH=argf("--thresh",0.75); GATE=argf("--gate",5); K=argf("--k",3); MAXTAGS=argf("--maxtags",50)
MODEL=args[args.index("--model")+1] if "--model" in args else "claude-opus-4-8"
USE_CLAUDE=MODEL.startswith("claude")
if not (URL and KEY and OPENAI): print("Missing env (Supabase + OPENAI_API_KEY)"); sys.exit(1)
if USE_CLAUDE and not ANT: print("Missing ANTHROPIC_API_KEY"); sys.exit(1)

TRANSIENT={500,502,503,504,520,521,522,523,524,525,529}
def http(method,url,headers=None,body=None,timeout=180):
    data=json.dumps(body).encode() if body is not None else None
    for attempt in range(6):
        req=urllib.request.Request(url,method=method,data=data); req.add_header("Content-Type","application/json")
        for k,v in (headers or {}).items(): req.add_header(k,v)
        try:
            with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
        except urllib.error.HTTPError as e:
            code=e.code; body=e.read().decode()[:400]
            if code in TRANSIENT and attempt<5: time.sleep(3*(attempt+1)); continue   # Cloudflare/transient 5xx
            return code, body
        except (urllib.error.URLError, OSError):   # incl. socket.timeout, conn reset
            if attempt==5: raise
            time.sleep(3*(attempt+1))
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
def rpc(name,body):
    st,tx=sb("POST",f"rpc/{name}",body)
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
def norm(t):
    t=re.sub(r"[^\w ]+$","",(t or "").strip().lower()); t=re.sub(r"^(the |a |an )","",t); return t.strip()
def embed(texts):
    out=[]
    for i in range(0,len(texts),256):
        chunk=[(t or " ")[:500] for t in texts[i:i+256]]
        for a in range(4):
            st,tx=http("POST","https://api.openai.com/v1/embeddings",
                {"Authorization":f"Bearer {OPENAI}"},{"model":"text-embedding-3-small","input":chunk})
            if st==200: break
            if a==3: raise RuntimeError(f"embed {st}: {tx[:200]}")
            time.sleep(2*(a+1))
        out.extend(d["embedding"] for d in sorted(json.loads(tx)["data"],key=lambda d:d["index"]))
        print(f"    embedded {min(i+256,len(texts))}/{len(texts)}")
    return out
def gemini(system,prompt):
    last=""
    for m in ("gemini-3.1-pro-preview","gemini-3.1-pro"):
        for toks in (32768,8192):
            st,tx=http("POST",f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={GEM}",
                body={"contents":[{"role":"user","parts":[{"text":system}]},{"role":"model","parts":[{"text":"Understood."}]},
                      {"role":"user","parts":[{"text":prompt}]}],"generationConfig":{"temperature":0.4,"maxOutputTokens":toks,"responseMimeType":"application/json"}})
            if st==200: return (json.loads(tx).get("candidates") or [{}])[0].get("content",{}).get("parts",[{}])[0].get("text","")
            last=f"{m} {st}";
            if st==404: break
            if st==400: continue
            raise RuntimeError(f"gemini {last}: {tx[:140]}")
    raise RuntimeError(f"no model ({last})")
def claude(system,prompt):
    st,tx=http("POST","https://api.anthropic.com/v1/messages",headers={"x-api-key":ANT,"anthropic-version":"2023-06-01"},
        body={"model":MODEL,"max_tokens":12000,"system":system,
              "messages":[{"role":"user","content":prompt+"\n\nReturn ONLY the raw JSON object — no fences, no prose."}]})
    if st==200: return "".join(p.get("text","") for p in (json.loads(tx).get("content") or []) if p.get("type")=="text")
    raise RuntimeError(f"claude {MODEL} {st}: {tx[:200]}")
def call_llm(s,p): return claude(s,p) if USE_CLAUDE else gemini(s,p)
def parse(t):
    try: return json.loads(t)
    except Exception:
        s=t.find("{"); e=t.rfind("}")
        if s>=0 and e>s:
            try: return json.loads(t[s:e+1])
            except Exception: return None
    return None

SYS_NAME=("You are a film-dramaturgy taxonomist naming TROPES (figure-types) for screenwriters and critics. "
  "Each group is a cluster of near-synonymous type-tags drawn from real films. For each, give a DISTINCT, "
  "specific title (a concrete craft category a writer would search — e.g. 'The Mentor's Death', "
  "'The Confession in the Rain', 'The Object That Carries Guilt'), a one-line laconic (<=14 words), and a "
  "2-sentence definition. Titles must be clearly distinct from one another; concrete nouns, not abstract "
  "critical concepts. Title Case.\n"
  'Return ONLY JSON: {"groups":[{"i":<1-based>,"title":"...","laconic":"...","definition":"..."}, ...]} one per group, in order.')

def main():
    print(f"[trope-build] thresh={THRESH} gate={GATE} {'PERSIST' if PERSIST else 'DRY'} model={MODEL}")
    fts=fetch_all("figure_tags?select=figure_id,tag")
    figs=fetch_all("figures?select=id,film_id&status=eq.approved")
    film_of={f["id"]:f["film_id"] for f in figs}
    tag_figs=defaultdict(set); tag_count=Counter()
    for r in fts:
        nt=norm(r["tag"])
        if nt: tag_figs[nt].add(r["figure_id"]); tag_count[nt]+=1
    ntags=list(tag_figs); print(f"  {len(fts)} tags → {len(ntags)} distinct normalized")

    have=set(r["tag"] for r in fetch_all("trope_tags?select=tag"))
    missing=[t for t in ntags if t not in have]
    if missing:
        print(f"  embedding+storing {len(missing)} new tags (interleaved, resumable)…")
        wrote=0
        for i in range(0,len(missing),200):
            chunk=missing[i:i+200]
            vecs=embed(chunk)
            rows=[{"tag":chunk[j],"embedding":vecs[j]} for j in range(len(chunk))]
            st,tx=sb("POST","trope_tags",rows,prefer="resolution=ignore-duplicates,return=minimal")
            if st>=300: print(f"    ! tag insert {st}: {tx[:120]}")
            else: wrote+=len(rows)
            print(f"    stored {wrote}/{len(missing)}")
        print("  embeddings stored.")

    # chunked ANN (one long statement would hit the 8s statement timeout)
    total=len(have) or len(ntags)
    pairs=[]
    for off in range(0, total, 1000):
        try:
            chunk=rpc("tag_sim_pairs",{"p_threshold":THRESH,"p_k":K,"p_offset":off,"p_limit":1000})
        except Exception as e:
            print(f"  ! pair chunk @{off}: {str(e)[:80]}"); continue
        pairs+=chunk
        print(f"  paired {min(off+1000,total)}/{total} ({len(pairs)} pairs)")
    parent={}
    def find(x):
        parent.setdefault(x,x)
        while parent[x]!=x: parent[x]=parent[parent[x]]; x=parent[x]
        return x
    for p in pairs:
        ra,rb=find(p["a"]),find(p["b"])
        if ra!=rb: parent[ra]=rb
    comp=defaultdict(list)
    for t in ntags:
        comp[find(t) if t in parent else t].append(t)
    clusters=list(comp.values())
    def films_of(cl):
        s=set()
        for nt in cl:
            for fid in tag_figs[nt]:
                if fid in film_of: s.add(film_of[fid])
        return s
    cands=[]; skipped_blob=0
    for cl in clusters:
        if len(cl)>MAXTAGS: skipped_blob+=1; continue   # chained mega-cluster, not a coherent trope
        fl=films_of(cl)
        if len(fl)>=GATE:
            top=[t for t,_ in Counter({nt:tag_count[nt] for nt in cl}).most_common(6)]
            cands.append({"tags":cl,"top":top,"films":len(fl),
                          "figs":set().union(*[tag_figs[nt] for nt in cl])})
    if skipped_blob: print(f"  (skipped {skipped_blob} over-{MAXTAGS}-tag chained clusters)")
    cands.sort(key=lambda c:-c["films"])
    sizes=sorted((len(cl) for cl in clusters), reverse=True)
    hist={"1":sum(1 for s in sizes if s==1),"2-3":sum(1 for s in sizes if 2<=s<=3),
          "4-10":sum(1 for s in sizes if 4<=s<=10),"11-30":sum(1 for s in sizes if 11<=s<=30),
          ">30":sum(1 for s in sizes if s>30)}
    print(f"  cluster sizes {hist}; largest={sizes[0] if sizes else 0} tags")
    if clusters:
        big=max(clusters,key=len)
        if len(big)>12: print(f"  ⚠ largest cluster ({len(big)} tags) sample: {big[:12]}")
    print(f"  {len(pairs)} pairs → {len(clusters)} clusters → {len(cands)} tropes (>= {GATE} films)")
    print("  — top 30 candidate tropes (by films): top member tags —")
    for c in cands[:30]:
        print(f"    [{c['films']}f] {' | '.join(c['top'][:4])}")
    if not PERSIST:
        print("[trope-build] DRY — no naming, no writes. Adjust --thresh if clusters look too broad/narrow.")
        return

    used=set(r["slug"] for r in fetch_all("meta_takes?select=slug"))
    created=0
    for i in range(0,len(cands),8):
        batch=cands[i:i+8]
        prompt="Name these trope groups (each = near-synonymous type-tags from films):\n"+"\n".join(
            f"\n--- Group {j+1} ---\ntags: {', '.join(b['top'])}" for j,b in enumerate(batch))+"\n\nName them now."
        try: out=parse(call_llm(SYS_NAME,prompt))
        except Exception as e: print(f"  ! name batch {i}: {e}"); continue
        groups=(out or {}).get("groups") or []
        gmap={g.get("i"):g for g in groups}
        for j,b in enumerate(batch):
            g=gmap.get(j+1) or {}
            title=(g.get("title") or b["top"][0]).strip()[:200]
            slug=slugify(title); base=slug; k=2
            while slug in used: slug=f"{base}-{k}"; k+=1
            used.add(slug)
            row={"slug":slug,"title":title,"laconic":g.get("laconic"),"thesis":g.get("definition"),
                 "raw_concept":b["top"][0],"kind":"figure_type","status":"published","source":"ai"}
            st,tx=sb("POST","meta_takes",[row],prefer="return=representation")
            if st>=300: print(f"  ! hub insert {st}: {tx[:140]}"); continue
            mt_id=json.loads(tx)[0]["id"]; created+=1
            ids=list(b["figs"])
            for x in range(0,len(ids),200):
                mem=[{"meta_take_id":mt_id,"figure_id":fid} for fid in ids[x:x+200]]
                sb("POST","figure_type_members",mem,prefer="resolution=ignore-duplicates,return=minimal")
        time.sleep(0.2)
    print(f"[trope-build] created {created} trope hubs + members. Deploy + check /tropes.")

if __name__=="__main__": main()
