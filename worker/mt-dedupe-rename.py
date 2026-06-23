#!/usr/bin/env python3
"""mt-dedupe-rename — fix duplicate-NAMED reading meta-take hubs (quality mode).

The expansion authoring named many DISTINCT clusters with the same generic title
(e.g. "The Displaced Wound" x17). Blind embedding-merge over-merges (text-embedding-3-small
has a high similarity floor on short critic text — 45% of hubs fall under 0.12), so instead
we let the LLM decide per same-name group, grounded in each hub's actual readings:

  For each title shared by >1 published reading hub:
    • give the model each member's sample readings (rationale + register + film)
    • it returns a DISTINCT, specific Title-Case name (+laconic+thesis) per member,
      differentiated from its siblings — OR the SAME name for members that are truly
      the same reading (those get merged).
    • members sharing a returned name  -> merge: move takes to the survivor (most films),
      mark losers merged_into + status='retired' (kept so the URL 301-redirects).
    • survivors get the new title/laconic/thesis; global title uniqueness enforced.

Then: re-embed every renamed survivor (title+thesis changed) via bulk_set_embeddings,
and NULL their seo_phrase so the SEO batch regenerates the <title> phrase.

DRY by default (previews names for the first --limit groups, no writes).
  python3 mt-dedupe-rename.py                 # DRY, sample 4 groups
  python3 mt-dedupe-rename.py --limit 8       # DRY, sample 8 groups
  python3 mt-dedupe-rename.py --persist       # do it for ALL duplicate-named groups
Options: --model claude-opus-4-8 (default) | --samples 6
"""
import os, sys, json, re, time, urllib.request, urllib.error
from collections import defaultdict, Counter

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
def argv(f,d):
    return type(d)(args[args.index(f)+1]) if f in args else d
LIMIT=argv("--limit", 4)          # DRY: how many groups to preview
SAMPLES=argv("--samples", 6)       # sample readings per hub fed to the model
MODEL=args[args.index("--model")+1] if "--model" in args else "claude-opus-4-8"
EMB_MODEL="text-embedding-3-small"
if not (URL and KEY): sys.exit("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)")
if not ANT: sys.exit("Missing ANTHROPIC_API_KEY")
if PERSIST and not OPENAI: sys.exit("Missing OPENAI_API_KEY (needed to re-embed renamed hubs)")

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
def rpc(name,body):
    st,tx=sb("POST",f"rpc/{name}",body,prefer="return=minimal")
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
    body={"model":MODEL,"max_tokens":max_tokens,"system":system,
          "messages":[{"role":"user","content":user}]}
    for attempt in range(5):
        st,tx=http("POST","https://api.anthropic.com/v1/messages",
                   {"x-api-key":ANT,"anthropic-version":"2023-06-01"}, body, timeout=180)
        if st==200:
            obj=json.loads(tx)
            return "".join(p.get("text","") for p in obj.get("content",[]) if p.get("type")=="text")
        if st in (429,500,502,503,529) and attempt<4: time.sleep(3*(attempt+1)); continue
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
    s=re.sub(r"<[^>]+>","",s or "").lower(); s=re.sub(r"[^a-z0-9]+","-",s).strip("-"); return s[:80] or "x"

def samples_for(hub_id):
    sel="rationale,register,figure:figures(label,film:films(title,year))"
    st,tx=sb("GET",f"takes?select={sel}&meta_take_id=eq.{hub_id}&order=confidence.desc&limit={SAMPLES}")
    if st!=200: return []
    out=[]
    for t in json.loads(tx):
        fig=(t.get("figure") or {}); film=(fig.get("film") or {})
        out.append({"film":f"{film.get('title','?')} ({film.get('year','')})".strip(),
                    "register":t.get("register") or "", "fig":fig.get("label") or "",
                    "rationale":(t.get("rationale") or "")[:240]})
    return out

SYS=("You are FilmCurio's film critic. Several 'meta-take' hubs — each a recurring critical "
     "reading found across many films — currently SHARE one generic title. Give EACH hub a "
     "DISTINCT, specific Title Case noun-phrase title that captures its particular reading and is "
     "clearly different from its siblings. Also a laconic (<=14 words) and a 2-3 sentence thesis. "
     "Never reuse a title across the group UNLESS two hubs are genuinely the SAME reading — in that "
     "case give them the IDENTICAL title (they will be merged). No first person, no named scholars, "
     "no jargon; voice clear and a touch playful. "
     'Return ONLY JSON: {"names":[{"i":<index>,"title":"...","laconic":"...","thesis":"..."}]}')

def name_group(title, members):
    lines=[f'These {len(members)} hubs all currently have the title "{title}". Name each distinctly:\n']
    for k,m in enumerate(members):
        lines.append(f"[i={k}] sample readings:")
        for s in (m["samples"] or [])[:SAMPLES]:
            lines.append(f"  - ({s['film']}; {s['register']}; figure: {s['fig']}) {s['rationale']}")
        if not m["samples"]: lines.append(f"  - (current thesis) {m['thesis'] or m['laconic'] or ''}")
        lines.append("")
    mt=min(8000, 500+len(members)*240)
    out=parse_json(call_llm(SYS,"\n".join(lines),max_tokens=mt))
    return {int(x["i"]):x for x in out.get("names",[]) if "i" in x}

def main():
    print(f"[dedupe-rename] model={MODEL} mode={'PERSIST' if PERSIST else 'DRY (sample %d groups)'%LIMIT}")
    hubs={h["id"]:h for h in fetch_all(
        "meta_takes?select=id,slug,title,laconic,thesis,raw_concept,created_at&kind=eq.reading&status=eq.published")}
    fc={r["meta_take_id"]:r["film_count"] for r in fetch_all("meta_take_film_counts?select=meta_take_id,film_count")}
    for hid,h in hubs.items(): h["films"]=fc.get(hid,0)

    groups=defaultdict(list)
    for h in hubs.values(): groups[h["title"]].append(h["id"])
    dup={t:ids for t,ids in groups.items() if len(ids)>1}
    used={t.lower() for t,ids in groups.items() if len(ids)==1}  # already-unique titles are reserved
    order=sorted(dup.items(), key=lambda kv:-len(kv[1]))
    print(f"  reading hubs={len(hubs)}  duplicate-named groups={len(dup)}  hubs in them={sum(len(v) for v in dup.values())}")

    todo=order if PERSIST else order[:LIMIT]
    renamed=[]   # (id, title, laconic, thesis)
    merges=[]    # (loser, survivor)
    for gi,(title,ids) in enumerate(todo,1):
        members=[]
        for hid in ids:
            h=hubs[hid]
            members.append({"id":hid,"slug":h["slug"],"films":h["films"],"created_at":h["created_at"],
                            "thesis":h["thesis"],"laconic":h["laconic"],"samples":samples_for(hid)})
        try: named=name_group(title,members)
        except Exception as e:
            print(f"  ! group '{title}' ({len(ids)}): LLM error {e}"); continue
        # bucket members by returned title (truly-same -> merge)
        buckets=defaultdict(list)
        for k,m in enumerate(members):
            g=named.get(k) or {}
            nt=(g.get("title") or "").strip()
            if not nt: nt=f"{title} ({m['slug']})"  # fallback: keep distinct via slug
            buckets[nt].append((k,m,g))
        print(f"\n[{gi}/{len(todo)}] \"{title}\"  x{len(ids)} -> {len(buckets)} distinct")
        for nt,mem in buckets.items():
            mem.sort(key=lambda x:(-x[1]["films"], x[1]["created_at"]))  # survivor first
            _,surv,sg=mem[0]
            # global uniqueness
            final=nt[:200]; low=final.lower()
            if low in used and low!=title.lower():
                topfilm=(surv["samples"][0]["film"].split(" (")[0] if surv["samples"] else "")
                cand=f"{nt} ({topfilm})"[:200] if topfilm else nt
                if cand.lower() in used:
                    n=2
                    while f"{nt} ({n})".lower() in used: n+=1
                    cand=f"{nt} ({n})"[:200]
                final=cand; low=final.lower()
            used.discard(title.lower()); used.add(low)
            tag="MERGE←" if len(mem)>1 else "rename"
            print(f"    {tag} \"{final}\"  [survivor {surv['slug']} · {surv['films']}f]"
                  +("" if len(mem)==1 else f"  absorbs {[m[1]['slug'] for m in mem[1:]]}"))
            renamed.append((surv["id"],final,sg.get("laconic"),sg.get("thesis")))
            for _,lo,_ in mem[1:]: merges.append((lo["id"],surv["id"]))
            if PERSIST:
                sb("PATCH",f"meta_takes?id=eq.{surv['id']}",
                   {"title":final,"laconic":sg.get("laconic"),"thesis":sg.get("thesis"),
                    "seo_phrase":None,"updated_at":"now()"},prefer="return=minimal")
                for _,lo,_ in mem[1:]:
                    sb("PATCH",f"takes?meta_take_id=eq.{lo['id']}",{"meta_take_id":surv["id"]},prefer="return=minimal")
                    sb("PATCH",f"meta_takes?id=eq.{lo['id']}",
                       {"merged_into":surv["id"],"status":"retired","updated_at":"now()"},prefer="return=minimal")

    print(f"\n[dedupe-rename] groups processed={len(todo)}  renamed survivors={len(renamed)}  merges={len(merges)}")
    if not PERSIST:
        print("  DRY — no writes. Re-run with --persist to apply to ALL groups."); return

    # re-embed renamed survivors (title+thesis changed -> embedding must follow)
    print(f"  re-embedding {len(renamed)} renamed hubs…")
    uniq={}
    for hid,t,lac,th in renamed: uniq[hid]=(t,th,lac)
    ids=list(uniq); texts=[f'{uniq[i][0]}. {uniq[i][1] or uniq[i][2] or ""}'.strip() for i in ids]
    vecs=embed(texts)
    for i in range(0,len(ids),100):
        rows=[{"id":ids[j],"e":vecs[j]} for j in range(i,min(i+100,len(ids)))]
        st,tx=sb("POST","rpc/bulk_set_embeddings",{"p_kind":"meta_take","p_rows":rows},prefer="return=minimal")
        if st>=300: print(f"    ! embed writeback {st}: {tx[:160]}")
    print("✅ Done. seo_phrase nulled on renamed hubs — run worker/run-mt-seo-fetch (submit+fetch) to refill titles.")
    print("   Merged hubs are status='retired' with merged_into set — deploy the /take redirect so their URLs 301.")

if __name__=="__main__": main()
