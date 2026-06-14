#!/usr/bin/env python3
"""Take cleanup pass (build step 2b) — house voice, no proper nouns, no 'Target Object'.

Seed Application text follows a fixed template ("Scholar X attempts to interpret
… the Target Object is ultimately revealed to be …"). This rewrites each take's
rationale into a single clean critical reading: drops researcher proper nouns and
the scaffolding, replaces 'the Target Object' with the concrete figure label, no
first person, ~60-90 words. The theorist/concept survive as structured metadata
(theorists table / meta take) — only the prose is cleaned.

Idempotent: only rationales that still contain template markers are processed
(unless --force). Usage: python3 mt-clean.py [--limit N] [--force] [--dry]
"""
import os, sys, json, re, time, urllib.request, urllib.error, urllib.parse
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p,encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY"); GEM=os.environ.get("GEMINI_API_KEY")
if not (URL and KEY and GEM): print("Missing env"); sys.exit(1)
args=sys.argv[1:]; DRY="--dry" in args; FORCE="--force" in args
LIMIT=int(args[args.index("--limit")+1]) if "--limit" in args else 100000
BATCH=10
MARKER=re.compile(r"target object|scholar|attempts to interpret|according to this interpretation", re.I)

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
def gemini(system,prompt):
    # Disable thinking (thinkingBudget:0) so the full token budget goes to the
    # JSON output — a thinking model otherwise burns the budget and truncates the
    # JSON (silent parse failure). Fall back to no-thinkingConfig, then next model.
    last=""
    for m in ("gemini-2.5-flash","gemini-3.5-flash"):
        for cfg in ({"thinkingConfig":{"thinkingBudget":0}}, {}):
            gc={"temperature":0.2,"maxOutputTokens":8192,"responseMimeType":"application/json"}
            gc.update(cfg)
            st,tx=http("POST",f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={GEM}",
                body={"contents":[{"role":"user","parts":[{"text":system}]},{"role":"model","parts":[{"text":"Understood."}]},
                      {"role":"user","parts":[{"text":prompt}]}],
                      "generationConfig":gc})
            if st==200:
                d=json.loads(tx); cand=(d.get("candidates") or [{}])[0]
                return cand.get("content",{}).get("parts",[{}])[0].get("text","")
            last=tx
            if st==404: break          # model absent -> next model
            if st==400: continue       # config rejected -> retry without thinkingConfig
            raise RuntimeError(f"gemini {st}: {tx[:160]}")
    raise RuntimeError(f"no model ({last[:120]})")
def parse(t):
    try: return json.loads(t)
    except Exception:
        s=t.find("{"); e=t.rfind("}")
        if s>=0 and e>s:
            try: return json.loads(t[s:e+1])
            except Exception: return None
    return None
def fetch_all(path):
    rows=[]; off=0
    while True:
        st,tx=sb("GET",f"{path}&limit=1000&offset={off}")
        if st!=200: raise RuntimeError(f"{st}: {tx[:160]}")
        b=json.loads(tx); rows+=b
        if len(b)<1000: break
        off+=1000
    return rows

SYSTEM=("You rewrite film-criticism notes into clean readings. For each item you get an ID, the OBJECT "
        "(a concrete element of a film) and the NOTE (which names a scholar and uses the placeholder "
        "'the Target Object'). Rewrite the NOTE as ONE clean paragraph (60-90 words): no researcher names, "
        "no 'Scholar X attempts…' framing, no phrase 'Target Object' (use the OBJECT itself as the subject), "
        "no first person. Keep the concrete critical insight. Direct, assertive, house voice.\n"
        "Return ONLY JSON: {\"items\":[{\"id\":\"<id>\",\"text\":\"<clean paragraph>\"}]}")

def main():
    rows=fetch_all("takes?select=id,rationale,figure:figures!inner(label)&rationale=not.is.null")
    todo=[r for r in rows if FORCE or MARKER.search(r["rationale"] or "")][:LIMIT]
    print(f"[clean] {len(todo)} takes to clean (of {len(rows)}){' [DRY]' if DRY else ''}")
    if DRY or not todo:
        if DRY and todo: print("  sample:", (todo[0]['rationale'] or '')[:120]);
        return
    def rewrite(sub):
        """Return {id: text} for a list of takes; {} on failure."""
        listing="\n\n".join(f'ID {r["id"]}\nOBJECT: {r["figure"]["label"]}\nNOTE: {(r["rationale"] or "")[:700]}' for r in sub)
        try: out=parse(gemini(SYSTEM, listing+"\n\nRewrite all now. JSON only."))
        except Exception as e: print(f"  ! {e}"); return {}
        if not out or "items" not in out: return {}
        return {i.get("id"):i.get("text") for i in out["items"] if i.get("id") and i.get("text")}

    done=err=0
    for off in range(0,len(todo),BATCH):
        chunk=todo[off:off+BATCH]
        byid=rewrite(chunk)
        # bisect-retry any take the model omitted or truncated (once)
        missing=[r for r in chunk if not byid.get(r["id"])]
        if missing and len(chunk)>1:
            mid=max(1,len(missing)//2)
            for sub in (missing[:mid], missing[mid:]):
                if sub: byid.update(rewrite(sub))
        for r in chunk:
            txt=byid.get(r["id"])
            if not txt: err+=1; continue
            st,_=sb("PATCH",f'takes?id=eq.{r["id"]}',{"rationale":txt.strip()},prefer="return=minimal")
            if st<300: done+=1
            else: err+=1
        if (off//BATCH)%10==0: print(f"  [clean] progress {off+len(chunk)}/{len(todo)} (done {done}, err {err})", flush=True)
        time.sleep(0.2)
    print(f"[clean] done: {done} cleaned, {err} errors")
if __name__=="__main__": main()
