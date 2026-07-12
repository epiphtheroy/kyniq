#!/usr/bin/env python3
"""bold-take-batch — submit & fetch bold-take generation via the Anthropic Message
Batches API (≈50% cheaper than synchronous). Pairs with bold-take-gen.py:

  1) python3 bold-take-gen.py --emit-requests --all --out bold-take-full
        → writes bold-take-full.requests.jsonl  (one {custom_id, params} per film;
          skips films already finished in bold-take-full.jsonl)
  2) python3 bold-take-batch.py submit --out bold-take-full   [--chunk 1000]
        → POSTs the requests as one or more batches; appends batch ids to
          bold-take-full.batchids.txt
  3) python3 bold-take-batch.py fetch  --out bold-take-full
        → polls each batch; for ENDED batches, downloads results and appends parsed
          {slug, invitation, takes} lines to bold-take-full.jsonl (same format as the
          synchronous full run). Re-run until all batches report ended.

Note: batch mode cannot do the sequential "avoid reusing a real person across films"
nudge (all requests are built up front), so a few popular figures may recur. That is
acceptable at corpus scale and can be diversified later if any name over-concentrates.
"""
import os, sys, json, re, time, urllib.request, urllib.error

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
ANT=os.environ.get("ANTHROPIC_API_KEY")
if not ANT: sys.exit("Missing ANTHROPIC_API_KEY")
args=sys.argv[1:]
MODE=args[0] if args and not args[0].startswith("-") else ""
def argf(f,d): return type(d)(args[args.index(f)+1]) if f in args else d
OUT=args[args.index("--out")+1] if "--out" in args else "bold-take-full"
CHUNK=argf("--chunk",1000)
PRICE_IN, PRICE_OUT = 5.0, 25.0   # standard; batch = 50%
HDR={"x-api-key":ANT,"anthropic-version":"2023-06-01","content-type":"application/json"}
API="https://api.anthropic.com/v1/messages/batches"

def http(method,url,headers=None,body=None,timeout=300):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(url,method=method,data=data)
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:800]
def repair_json(s):
    """Re-escape stray double-quotes / control chars inside string VALUES — the common LLM
    failure (e.g.  "...meaning "the swamp" or "the marsh"..."  where the inner quotes aren't
    escaped). A quote inside a string is treated as the real close only if the next non-space
    char is structural (,:}]) or EOF; otherwise it is escaped."""
    out=[]; in_str=False; esc=False; n=len(s)
    for i,ch in enumerate(s):
        if esc: out.append(ch); esc=False; continue
        if ch=="\\": out.append(ch); esc=True; continue
        if ch=='"':
            if not in_str: in_str=True; out.append(ch); continue
            j=i+1
            while j<n and s[j] in " \t\r\n": j+=1
            nxt=s[j] if j<n else ""
            if nxt in ",:}]" or nxt=="": in_str=False; out.append(ch)
            else: out.append('\\"')
            continue
        if in_str and ch in "\n\r\t": out.append({"\n":"\\n","\r":"\\r","\t":"\\t"}[ch]); continue
        out.append(ch)
    return "".join(out)

def parse_json(s):
    s=s.strip()
    if s.startswith("```"): s=re.sub(r"^```[a-z]*\n?","",s); s=re.sub(r"\n?```$","",s)
    i=s.find("{"); j=s.rfind("}")
    if i>=0 and j>i: s=s[i:j+1]
    try: return json.loads(s)
    except json.JSONDecodeError: return json.loads(repair_json(s))   # tolerate stray quotes

def submit():
    reqpath=f"{OUT}.requests.jsonl"
    if not os.path.exists(reqpath): sys.exit(f"missing {reqpath} — run: python3 bold-take-gen.py --emit-requests --all --out {OUT}")
    reqs=[json.loads(l) for l in open(reqpath,encoding="utf-8") if l.strip()]
    if not reqs: print("no requests to submit (all films already emitted) — nothing to do."); return
    print(f"[batch submit] {len(reqs)} requests · chunk={CHUNK}")
    ids=[]
    for i in range(0,len(reqs),CHUNK):
        part=reqs[i:i+CHUNK]
        st,tx=http("POST",API,HDR,{"requests":part})
        if st>=300: print(f"  ! submit {st}: {tx[:300]}"); break
        bid=json.loads(tx).get("id"); ids.append(bid)
        with open(f"{OUT}.submitted.txt","a",encoding="utf-8") as sf:
            sf.write("\n".join(r["custom_id"] for r in part)+"\n")
        print(f"  ✓ batch {bid}  ({len(part)} reqs)")
        time.sleep(1)
    if ids:
        with open(f"{OUT}.batchids.txt","a",encoding="utf-8") as f: f.write("\n".join(ids)+"\n")
        print(f"✅ submitted {len(ids)} batch(es) → {OUT}.batchids.txt\n   When ended, run:  python3 bold-take-batch.py fetch --out {OUT}")

def fetch():
    idpath=f"{OUT}.batchids.txt"
    if not os.path.exists(idpath): sys.exit(f"missing {idpath} — submit first")
    ids=[l.strip() for l in open(idpath,encoding="utf-8") if l.strip()]
    done=set()
    full=f"{OUT}.jsonl"
    if os.path.exists(full):
        for l in open(full,encoding="utf-8"):
            try: done.add(json.loads(l).get("slug"))
            except Exception: pass
    fh=open(full,"a",encoding="utf-8")
    tin=tout=0; got=0; pend=[]; err=0
    for bid in ids:
        st,tx=http("GET",f"{API}/{bid}",HDR)
        if st>=300: print(f"  ! {bid} status {st}: {tx[:160]}"); continue
        o=json.loads(tx); status=o.get("processing_status"); rc=o.get("request_counts",{})
        if status!="ended":
            pend.append((bid,status,rc)); print(f"  … {bid}: {status}  {rc}"); continue
        rurl=o.get("results_url")
        st2,body=http("GET",rurl,HDR)
        if st2>=300: print(f"  ! {bid} results {st2}: {body[:160]}"); continue
        for line in body.splitlines():
            line=line.strip()
            if not line: continue
            try: r=json.loads(line)
            except Exception: continue
            cid=r.get("custom_id"); res=r.get("result",{})
            if not cid or cid in done: continue
            def _logfail(reason, extra):
                with open(f"{OUT}.failures.jsonl","a",encoding="utf-8") as ff:
                    ff.write(json.dumps({"slug":cid,"reason":reason,**extra},ensure_ascii=False)+"\n")
            if res.get("type")!="succeeded":
                err+=1; print(f"    ! {cid}: {res.get('type')}")
                _logfail(res.get("type") or "unknown", {"detail":str(res)[:300]}); continue
            msg=res.get("message",{}); u=msg.get("usage",{})
            tin+=u.get("input_tokens",0); tout+=u.get("output_tokens",0)
            text="".join(p.get("text","") for p in msg.get("content",[]) if p.get("type")=="text")
            try: parsed=parse_json(text)
            except Exception as e:
                err+=1; print(f"    ! {cid}: parse fail ({e})")
                _logfail("parse_fail", {"error":str(e)[:200], "stop":msg.get("stop_reason"), "text":text[:4000]}); continue
            fh.write(json.dumps({"slug":cid,"invitation":parsed.get("invitation",""),
                                 "takes":parsed.get("takes",[])},ensure_ascii=False)+"\n"); fh.flush()
            done.add(cid); got+=1
    fh.close()
    cost=(tin/1e6*PRICE_IN+tout/1e6*PRICE_OUT)*0.5
    print(f"\n✅ fetched {got} new films this run · batch cost ${cost:,.2f} (50% rate) · errors {err}")
    print(f"   total in {full}: {len(done)}")
    if pend:
        print(f"   still processing: {len(pend)} batch(es) — re-run fetch later:")
        for bid,stt,rc in pend: print(f"     {bid}: {stt} {rc}")

if __name__=="__main__":
    if MODE=="submit": submit()
    elif MODE=="fetch": fetch()
    else: sys.exit("usage: bold-take-batch.py [submit|fetch] --out bold-take-full [--chunk 1000]")
