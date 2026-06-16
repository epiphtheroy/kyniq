#!/usr/bin/env python3
"""mt-retitle-splits — give split sibling hubs DISTINCT titles/laconics (+ essays).

When an oversized hub was split into N pieces, each piece kept the SAME name (the
model named each in isolation). This groups published hubs by slug base
(e.g. 'the-face-of-the-other' + '-2'..'-9') and, for each family, asks the model —
seeing ALL siblings at once — to assign each a DISTINCT, more specific title +
one-line laconic. With --essays it also rewrites each sibling's thesis + essay so
the body matches the narrower title. New unique slugs are generated from the titles.

Nothing is created or moved: same hubs, same takes — only name/definition change.
Naturally idempotent (once renamed, siblings no longer share a slug base).
DEFAULT IS DRY. Pass --persist to write.

Usage: python3 mt-retitle-splits.py [--persist] [--essays] [--limit N]
"""
import os, sys, json, re, time, urllib.request, urllib.error, urllib.parse
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
GEM=os.environ.get("GEMINI_API_KEY"); ANT=os.environ.get("ANTHROPIC_API_KEY")
args=sys.argv[1:]; PERSIST="--persist" in args; ESSAYS="--essays" in args
LIMIT=int(args[args.index("--limit")+1]) if "--limit" in args else 100000
MODEL=args[args.index("--model")+1] if "--model" in args else "claude-opus-4-8"   # default Claude (Gemini quota)
USE_CLAUDE=MODEL.startswith("claude")
if not (URL and KEY): print("Missing Supabase env"); sys.exit(1)
if USE_CLAUDE and not ANT: print("Missing ANTHROPIC_API_KEY"); sys.exit(1)
if (not USE_CLAUDE) and not GEM: print("Missing GEMINI_API_KEY"); sys.exit(1)

def http(method,url,headers=None,body=None,timeout=180):
    data=json.dumps(body).encode() if body is not None else None
    for attempt in range(4):
        req=urllib.request.Request(url,method=method,data=data); req.add_header("Content-Type","application/json")
        for k,v in (headers or {}).items(): req.add_header(k,v)
        try:
            with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
        except urllib.error.HTTPError as e: return e.code, e.read().decode()[:400]
        except urllib.error.URLError:
            if attempt==3: raise
            time.sleep(2*(attempt+1))
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
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
def gemini(system,prompt,temp=0.5):
    last=""
    for m in ("gemini-3.1-pro-preview","gemini-3.1-pro"):
        for toks in (32768, 8192):
            gc={"temperature":temp,"maxOutputTokens":toks,"responseMimeType":"application/json"}
            st,tx=http("POST",f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={GEM}",
                body={"contents":[{"role":"user","parts":[{"text":system}]},
                      {"role":"model","parts":[{"text":"Understood."}]},
                      {"role":"user","parts":[{"text":prompt}]}],"generationConfig":gc})
            if st==200:
                d=json.loads(tx); cand=(d.get("candidates") or [{}])[0]
                return cand.get("content",{}).get("parts",[{}])[0].get("text","")
            last=f"{m} {st}: {tx[:160]}"
            if st==404: break
            if st==400: continue
            raise RuntimeError(f"gemini {last}")
    raise RuntimeError(f"no model ({last})")
def claude(system,prompt):
    # Anthropic path (Opus 4.8). Note: Opus 4.8 rejects `temperature` (deprecated).
    st,tx=http("POST","https://api.anthropic.com/v1/messages",
        headers={"x-api-key":ANT,"anthropic-version":"2023-06-01"},
        body={"model":MODEL,"max_tokens":16000,"system":system,
              "messages":[{"role":"user","content":prompt+"\n\nReturn ONLY the raw JSON object — no markdown fences, no prose."}]})
    if st==200:
        d=json.loads(tx)
        return "".join(p.get("text","") for p in (d.get("content") or []) if p.get("type")=="text")
    raise RuntimeError(f"claude {MODEL} {st}: {tx[:200]}")
def call_llm(system,prompt):
    return claude(system,prompt) if USE_CLAUDE else gemini(system,prompt)
def parse(t):
    try: return json.loads(t)
    except Exception:
        s=t.find("{"); e=t.rfind("}")
        if s>=0 and e>s:
            try: return json.loads(t[s:e+1])
            except Exception: return None
    return None

SYS_TITLES=("You are FilmCurio's critic and taxonomist. A broad film-criticism concept was divided into "
  "several sub-groups by semantic similarity of their readings. Give EACH sub-group a DISTINCT, specific "
  "title (short noun phrase, Title Case) and a one-line laconic (<=16 words). RULES: every title must be "
  "clearly different from the others; each must be MORE SPECIFIC than the broad concept; none may equal the "
  "broad name; no scholar names. Capture what makes THIS group different from its siblings.\n"
  'Return ONLY JSON: {"groups":[{"i":<1-based index>,"title":"...","laconic":"..."}, ...]} — exactly one entry per group, in order.')
SYS_ESSAY=("You are FilmCurio's critic. Write the wiki page body for a film-criticism concept with the GIVEN title. "
  "Voice: clear, smart, a touch playful. No first person, no named scholars in the prose.\n"
  'Return ONLY JSON: {"thesis":"<2-3 sentences defining it as a reading of films>","essay":"<250-400 words '
  'weaving 3-5 of the listed films, naming them exactly as given; show how each embodies it>"}')

def samples(member_id, n=6):
    sel="rationale,figure:figures!inner(label,film:films!inner(title,year,slug))"
    st,tx=sb("GET",f"takes?select={urllib.parse.quote(sel,safe='!,():*')}&meta_take_id=eq.{member_id}&limit={n}")
    return json.loads(tx) if st==200 else []
def lines_of(takes):
    out=[]
    for t in takes:
        f=t["figure"]["film"]
        out.append(f'- {f["title"]} ({f.get("year") or "?"}): {t["figure"]["label"]} — {(t.get("rationale") or "")[:170]}')
    return out

def main():
    pubs=fetch_all("meta_takes?select=id,slug,title&status=eq.published")
    fams=defaultdict(list)
    # Group by IDENTICAL TITLE — that is exactly the problem we fix (siblings that
    # ended up with the same name), and it catches cases the slug base misses.
    for m in pubs: fams[(m.get("title") or "").strip().lower()].append(m)
    families=[(b,ms) for b,ms in fams.items() if len(ms)>1]
    families.sort(key=lambda x:-len(x[1]))
    families=families[:LIMIT]
    used=set(m["slug"] for m in pubs)
    print(f"[retitle] {len(families)} split families, {sum(len(ms) for _,ms in families)} hubs "
          f"{'PERSIST' if PERSIST else 'DRY'}{' +essays' if ESSAYS else ''}")
    done=0
    for b,ms in families:
        ms=sorted(ms,key=lambda m:m["slug"])
        ss=[samples(m["id"]) for m in ms]
        broad=ms[0]["title"]
        promptA=f"BROAD CONCEPT: {broad}\n{len(ms)} sub-groups:\n"+"\n".join(
            f"\n--- Group {i+1}: sample readings ---\n"+"\n".join(lines_of(ss[i])) for i in range(len(ms)))+"\n\nName the groups now."
        try: outA=parse(call_llm(SYS_TITLES,promptA))
        except Exception as e: print(f"  ! {b}: titles failed: {e}"); continue
        groups=(outA or {}).get("groups") or []
        if len(groups)!=len(ms):
            print(f"  ! {b}: got {len(groups)} titles for {len(ms)} groups — skip"); continue
        print(f"\n  {b}  ({len(ms)} groups)")
        for i,m in enumerate(ms):
            g=groups[i]; nt=(g.get("title") or m["title"]).strip(); nl=(g.get("laconic") or "").strip()
            print(f"    {i+1}. {nt}  —  {nl}")
            if not PERSIST: continue
            upd={"title":nt[:200],"laconic":nl}
            if ESSAYS:
                films={t["figure"]["film"]["slug"]:t["figure"]["film"] for t in ss[i]}
                pB=f"TITLE: {nt}\nFilms & readings:\n"+"\n".join(lines_of(ss[i]))+"\n\nWrite the JSON now."
                try:
                    outB=parse(call_llm(SYS_ESSAY,pB))
                    if outB and outB.get("essay"):
                        essay=outB["essay"]
                        for slug,f in sorted(films.items(),key=lambda kv:-len(kv[1]["title"])):
                            essay=re.sub(re.escape(f["title"]),"{{film:"+slug+"}}",essay,count=1)
                        upd["thesis"]=outB.get("thesis"); upd["essay"]=essay
                except Exception as e: print(f"      ! essay failed: {e}")
            ns=slugify(nt); base=ns; k=2
            while ns in used: ns=f"{base}-{k}"; k+=1
            used.add(ns); upd["slug"]=ns; upd["updated_at"]="now()"
            st,_=sb("PATCH",f"meta_takes?id=eq.{m['id']}",upd,prefer="return=minimal")
            if st<300: done+=1
            else: print(f"      ! update failed {st}")
            time.sleep(0.2)
    print(f"\n[retitle] {'updated '+str(done)+' hubs' if PERSIST else 'DRY — no writes'}. "
          f"{'Re-run mt-rank/mt-recommend not needed (titles only) ; ' if not ESSAYS else ''}Done.")

if __name__=="__main__": main()
