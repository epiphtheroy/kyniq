#!/usr/bin/env python3
"""trope-tag (Tropes stage 1) — film-agnostic TYPE tags per figure.

Why: figure-description embeddings cluster by *film* (and cross-film by style),
not by dramaturgical type. So we can't derive tropes from raw similarity — we
must abstract each figure to a film-agnostic TYPE first. This worker does that:
batched per film (1 call/film → ~562 calls), it assigns each figure up to 3 type
tags — the recurring dramatic device / situation / object-function a SCREENWRITER
would search for (e.g. "the death of a child", "the heist crew assembled").

Stage 2 (consolidate) then embeds + clusters these tags into named trope hubs.

Idempotent: only figures without tags are processed. DEFAULT IS DRY (prints tags
for --limit films, no writes). Pass --persist to write all.

Usage: python3 trope-tag.py [--persist] [--limit N] [--model claude-opus-4-8]
"""
import os, sys, json, time, urllib.request, urllib.error, urllib.parse
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
args=sys.argv[1:]; PERSIST="--persist" in args
LIMIT=int(args[args.index("--limit")+1]) if "--limit" in args else (100000 if PERSIST else 3)
MODEL=args[args.index("--model")+1] if "--model" in args else "claude-opus-4-8"
USE_CLAUDE=MODEL.startswith("claude")
MAX_TAGS=3; CHUNK=10
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
def gemini(system,prompt):
    last=""
    for m in ("gemini-3.1-pro-preview","gemini-3.1-pro"):
        for toks in (32768,8192):
            st,tx=http("POST",f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={GEM}",
                body={"contents":[{"role":"user","parts":[{"text":system}]},{"role":"model","parts":[{"text":"Understood."}]},
                      {"role":"user","parts":[{"text":prompt}]}],"generationConfig":{"temperature":0.3,"maxOutputTokens":toks,"responseMimeType":"application/json"}})
            if st==200:
                d=json.loads(tx); return (d.get("candidates") or [{}])[0].get("content",{}).get("parts",[{}])[0].get("text","")
            last=f"{m} {st}: {tx[:140]}"
            if st==404: break
            if st==400: continue
            raise RuntimeError(f"gemini {last}")
    raise RuntimeError(f"no model ({last})")
def claude(system,prompt):
    st,tx=http("POST","https://api.anthropic.com/v1/messages",
        headers={"x-api-key":ANT,"anthropic-version":"2023-06-01"},
        body={"model":MODEL,"max_tokens":8000,"system":system,
              "messages":[{"role":"user","content":prompt+"\n\nReturn ONLY the raw JSON object — no markdown fences, no prose."}]})
    if st==200:
        d=json.loads(tx)
        return "".join(p.get("text","") for p in (d.get("content") or []) if p.get("type")=="text")
    raise RuntimeError(f"claude {MODEL} {st}: {tx[:200]}")
def call_llm(system,prompt): return claude(system,prompt) if USE_CLAUDE else gemini(system,prompt)
def parse(t):
    try: return json.loads(t)
    except Exception:
        s=t.find("{"); e=t.rfind("}")
        if s>=0 and e>s:
            try: return json.loads(t[s:e+1])
            except Exception: return None
    return None

SYS=("You are a film-dramaturgy taxonomist. Each item is a FIGURE — a concrete element of a film "
  "(a character, object, scene, image, or device). Assign each up to 3 FILM-AGNOSTIC TYPE TAGS: short "
  "noun phrases naming the recurring DRAMATIC DEVICE / SITUATION / OBJECT-FUNCTION a SCREENWRITER would "
  "search for. Examples: 'the death of a child', 'the heist crew assembled', 'the object that carries guilt', "
  "'the mentor's death', 'the confession in the rain', 'the doppelganger', 'the last phone call'.\n"
  "RULES: (1) strip ALL film-specific names and plot — name the TYPE, not this instance; "
  "(2) each tag must be a category that could recur across many different films; "
  "(3) do NOT use abstract critical concepts (e.g. 'alienation', 'the male gaze') — those are readings, not types; "
  "(4) give 1 PRIMARY tag that best classifies it, plus up to 2 SECONDARY only if clearly applicable; "
  "(5) lowercase short noun phrases.\n"
  'Return ONLY JSON: {"figures":[{"i":<the integer index shown in [brackets]>,"tags":["primary","secondary?","secondary?"]}, ...]} — one entry per figure, identified by its bracket index (NOT any other id).')

def main():
    tagged=set(r["figure_id"] for r in fetch_all("figure_tags?select=figure_id"))
    figs=fetch_all("figures?select=id,film_id,label,description&status=eq.approved")
    todo=[f for f in figs if f["id"] not in tagged]
    by_film=defaultdict(list)
    for f in todo: by_film[f["film_id"]].append(f)
    film_ids=list(by_film.keys())[:LIMIT]
    films={}
    for i in range(0,len(film_ids),200):
        ids=",".join(film_ids[i:i+200])
        st,tx=sb("GET",f"films?select=id,title,year&id=in.({ids})")
        if st==200:
            for r in json.loads(tx): films[r["id"]]={"title":r["title"],"year":r.get("year")}
    print(f"[trope-tag] {len(todo)} untagged figures across {len(by_film)} films; processing {len(film_ids)} "
          f"{'(PERSIST)' if PERSIST else '(DRY)'} model={MODEL}")
    n_tags=0
    for fid in film_ids:
        fl=films.get(fid,{"title":"?","year":None}); group=by_film[fid]
        for c in range(0,len(group),CHUNK):
            chunk=group[c:c+CHUNK]
            # Identify figures by a short integer index, never the UUID (LLMs mangle long UUIDs → FK errors).
            lines=[f'[{j+1}] {f["label"]} — {(f.get("description") or "")[:300]}' for j,f in enumerate(chunk)]
            prompt=f'FILM: {fl["title"]} ({fl.get("year") or "?"})\nFigures:\n'+"\n".join(lines)+"\n\nTag them now."
            try: out=parse(call_llm(SYS,prompt))
            except Exception as e: print(f"  ! {fl['title']}: {e}"); continue
            items=(out or {}).get("figures") or []
            rows=[]
            for it in items:
                try: idx=int(it.get("i"))
                except Exception: continue
                if idx<1 or idx>len(chunk): continue
                fid2=chunk[idx-1]["id"]
                tags=[t.strip().lower() for t in (it.get("tags") or []) if t and t.strip()][:MAX_TAGS]
                if not tags: continue
                for r,tg in enumerate(tags): rows.append({"figure_id":fid2,"tag":tg,"rank":r+1})
            if not PERSIST:
                for it in items[:6]:
                    try: lbl=chunk[int(it.get("i"))-1]["label"][:40]
                    except Exception: lbl="?"
                    print(f"  · {fl['title']}: {lbl} → {it.get('tags')}")
                n_tags+=len(rows); continue
            if rows:
                st,tx=sb("POST","figure_tags",rows,prefer="resolution=ignore-duplicates,return=minimal")
                if st<300: n_tags+=len(rows)
                else: print(f"  ! insert {st}: {tx[:140]}")
            time.sleep(0.15)
    print(f"[trope-tag] {'wrote' if PERSIST else 'would write'} {n_tags} tags. Next: stage 2 (cluster + name).")

if __name__=="__main__": main()
