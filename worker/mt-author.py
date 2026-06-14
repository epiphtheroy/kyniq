#!/usr/bin/env python3
"""Meta Take authoring (build step 4a) — title/laconic/thesis/essay.

For each candidate meta_take that passes the hub gate (>=5 films), a strong
LLM writes: a noun-phrase title (refined), a one-line laconic, a 2-3 sentence
thesis, and a 250-400 word essay weaving 3-5 of its films. Film mentions in the
essay are deterministically linkified to {{film:uuid}} tokens. Sets the take's
status to 'published' (publish-then-audit; admin can retire/split later).
Re-runnable (only un-authored candidates unless --force).

Usage: python3 mt-author.py [--limit N] [--force] [--dry]
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

def http(method,url,headers=None,body=None,timeout=120):
    req=urllib.request.Request(url,method=method,data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type","application/json")
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:400]
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
def gemini(system,prompt):
    # Disable thinking (thinkingBudget:0) so the token budget produces the essay
    # JSON rather than being consumed by thinking and truncated. Fall back to no
    # thinkingConfig, then to the next model.
    last=""
    for m in ("gemini-2.5-flash","gemini-3.5-flash"):
        for cfg in ({"thinkingConfig":{"thinkingBudget":0}}, {}):
            gc={"temperature":0.4,"maxOutputTokens":8192,"responseMimeType":"application/json"}
            gc.update(cfg)
            st,tx=http("POST",f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={GEM}",
                body={"contents":[{"role":"user","parts":[{"text":system}]},{"role":"model","parts":[{"text":"Understood."}]},
                      {"role":"user","parts":[{"text":prompt}]}],
                      "generationConfig":gc})
            if st==200:
                d=json.loads(tx); cand=(d.get("candidates") or [{}])[0]
                return cand.get("content",{}).get("parts",[{}])[0].get("text","")
            last=tx
            if st==404: break
            if st==400: continue
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

SYSTEM=("You are FilmCurio's critic. Given a recurring critical concept and how it appears across several films, "
        "write its wiki page text. Voice: clear, smart, a touch playful — like the best film-criticism reference. "
        "NOT academic jargon, NO first person, NO named scholars in the prose.\n"
        "Return ONLY JSON: {\"title\":\"<short NOUN PHRASE, Title Case, e.g. 'The Disposable Worker'>\","
        "\"laconic\":\"<one punchy line, <=14 words>\","
        "\"thesis\":\"<2-3 sentences defining the concept as a reading of films>\","
        "\"essay\":\"<250-400 words weaving 3-5 of the listed films, naming them exactly as given; "
        "show how differently each embodies the concept>\"}")

def main():
    sel=("id,slug,title,raw_concept,status,"
         "takes(rationale,figure:figures!inner(label,film:films!inner(title,year,slug)))")
    q=f"meta_takes?select={urllib.parse.quote(sel,safe='!,():*')}&status=eq.candidate"
    if not FORCE: q+="&essay=is.null"
    st,tx=sb("GET",q+f"&limit={LIMIT}")
    if st!=200: print(f"{st}: {tx[:200]}"); sys.exit(1)
    mts=json.loads(tx)
    print(f"[author] {len(mts)} candidate meta takes to author{' [DRY]' if DRY else ''}")
    done=0
    for mt in mts:
        takes=mt.get("takes") or []
        # distinct films
        films={}
        for t in takes:
            f=t["figure"]["film"]; films[f["slug"]]={"title":f["title"],"year":f["year"],"slug":f["slug"]}
        if len(films)<5: continue
        sample=takes[:8]
        lines=[f'- {t["figure"]["film"]["title"]} ({t["figure"]["film"].get("year") or "?"}): '
               f'{t["figure"]["label"]} — {(t.get("rationale") or "")[:200]}' for t in sample]
        prompt=(f'CONCEPT: {mt["title"]}\nAppears in {len(films)} films. Examples:\n'+"\n".join(lines)+
                "\n\nWrite the page JSON now.")
        if DRY:
            print(f"  · {mt['title']} ({len(films)} films)"); continue
        try: out=parse(gemini(SYSTEM,prompt))
        except Exception as e: print(f"  ! {mt['slug']}: {e}"); continue
        if not out or not out.get("essay"): print(f"  ! {mt['slug']}: bad output"); continue
        essay=out["essay"]
        # deterministic linkify: wrap known film titles as {{film:slug}} (render resolves slug→uuid+title)
        for slug,f in sorted(films.items(), key=lambda kv:-len(kv[1]["title"])):
            essay=re.sub(re.escape(f["title"]), "{{film:"+slug+"}}", essay, count=1)
        upd={"title":(out.get("title") or mt["title"])[:200],"laconic":out.get("laconic"),
             "thesis":out.get("thesis"),"essay":essay,"status":"published","updated_at":"now()"}
        st,_=sb("PATCH",f"meta_takes?id=eq.{mt['id']}",upd,prefer="return=minimal")
        if st<300:
            done+=1
            sb("POST","content_events",{"entity_type":"meta_take","entity_id":mt["id"],
                "event":"meta_take_published_unreviewed","actor_kind":"ai","meta":{"slug":mt["slug"]}},prefer="return=minimal")
        time.sleep(0.3)
    print(f"[author] done: {done} meta takes authored + published (audit after). Next: mt-rank.py, mt-recommend.py")

if __name__=="__main__": main()
