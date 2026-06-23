#!/usr/bin/env python3
"""trope-gate-batch — submit & fetch the critic-gate calls via the Anthropic Message Batches
API (~50% cheaper). Pairs with trope-form.py:

  1) python3 trope-form.py emit          → trope-gate-requests.jsonl + trope-gate-map.json
  2) python3 trope-gate-batch.py submit  → POSTs requests; appends ids to trope-gate.batchids.txt
  3) python3 trope-gate-batch.py fetch   → polls; for ENDED batches appends {custom_id,text}
                                            lines to trope-gate-results.jsonl (re-run until done)
  4) python3 trope-form.py finalize      → trope-plan.json (apply gate, ≥2 films & ≥2 members)

Resumable: submit skips custom_ids already in .submitted.txt or results; fetch skips custom_ids
already in results.
"""
import os, sys, json, time, urllib.request, urllib.error

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
args=sys.argv[1:]; MODE=args[0] if args and not args[0].startswith("-") else ""
def argf(f,d): return type(d)(args[args.index(f)+1]) if f in args else d
CHUNK=argf("--chunk",2000)
REQ=os.path.join(HERE,"trope-gate-requests.jsonl"); MAP=os.path.join(HERE,"trope-gate-map.json")
RES=os.path.join(HERE,"trope-gate-results.jsonl")
BIDS=os.path.join(HERE,"trope-gate.batchids.txt"); SUB=os.path.join(HERE,"trope-gate.submitted.txt")
PRICE_IN,PRICE_OUT=5.0,25.0
HDR={"x-api-key":ANT,"anthropic-version":"2023-06-01","content-type":"application/json"}
API="https://api.anthropic.com/v1/messages/batches"

def http(method,url,headers=None,body=None,timeout=300):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(url,method=method,data=data)
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:800]

def done_ids(results_only=False):
    """custom_ids already handled. submit() skips RES∪SUB (don't resubmit); fetch() must skip
    RES only (SUB=submitted is NOT yet fetched — including it would skip writing every result)."""
    d=set()
    srcs=(RES,) if results_only else (RES,SUB)
    for p in srcs:
        if os.path.exists(p):
            for l in open(p,encoding="utf-8"):
                l=l.strip()
                if not l: continue
                if p==RES:
                    try: d.add(json.loads(l).get("custom_id"))
                    except Exception: pass
                else: d.add(l)
    return d

def submit():
    if not os.path.exists(REQ): sys.exit(f"missing {REQ} — run: python3 trope-form.py emit")
    done=done_ids()
    reqs=[json.loads(l) for l in open(REQ,encoding="utf-8") if l.strip()]
    reqs=[r for r in reqs if r["custom_id"] not in done]
    if not reqs: sys.exit("nothing to submit (all custom_ids already submitted/fetched)")
    print(f"[submit] {len(reqs)} requests · chunk={CHUNK}")
    ids=[]
    for i in range(0,len(reqs),CHUNK):
        part=reqs[i:i+CHUNK]
        st,tx=http("POST",API,HDR,{"requests":part})
        if st>=300: print(f"  ! submit {st}: {tx[:300]}"); break
        bid=json.loads(tx).get("id"); ids.append(bid)
        with open(SUB,"a",encoding="utf-8") as sf: sf.write("\n".join(r["custom_id"] for r in part)+"\n")
        print(f"  ✓ batch {bid} ({len(part)})"); time.sleep(1)
    if ids:
        with open(BIDS,"a",encoding="utf-8") as f: f.write("\n".join(ids)+"\n")
        print(f"✅ submitted {len(ids)} batch(es). When ended: python3 trope-gate-batch.py fetch")

def fetch():
    if not os.path.exists(BIDS): sys.exit("no batchids — submit first")
    ids=[l.strip() for l in open(BIDS,encoding="utf-8") if l.strip()]
    done=done_ids(results_only=True)
    fh=open(RES,"a",encoding="utf-8")
    tin=tout=got=err=0; pend=[]
    for bid in ids:
        st,tx=http("GET",f"{API}/{bid}",HDR)
        if st>=300: print(f"  ! {bid} {st}: {tx[:160]}"); continue
        o=json.loads(tx); status=o.get("processing_status"); rc=o.get("request_counts",{})
        if status!="ended": pend.append((bid,status,rc)); print(f"  … {bid}: {status} {rc}"); continue
        st2,body=http("GET",o.get("results_url"),HDR)
        if st2>=300: print(f"  ! {bid} results {st2}"); continue
        for line in body.splitlines():
            line=line.strip()
            if not line: continue
            try: r=json.loads(line)
            except Exception: continue
            cid=r.get("custom_id"); res=r.get("result",{})
            if not cid or cid in done: continue
            if res.get("type")!="succeeded": err+=1; continue
            msg=res.get("message",{}); u=msg.get("usage",{})
            tin+=u.get("input_tokens",0); tout+=u.get("output_tokens",0)
            text="".join(p.get("text","") for p in msg.get("content",[]) if p.get("type")=="text")
            fh.write(json.dumps({"custom_id":cid,"text":text},ensure_ascii=False)+"\n"); fh.flush()
            done.add(cid); got+=1
    fh.close()
    cost=(tin/1e6*PRICE_IN+tout/1e6*PRICE_OUT)*0.5
    print(f"\n✅ fetched {got} new this run · batch cost ${cost:,.2f} (50%) · errors {err} · total {len(done)}")
    if pend:
        print(f"   still processing {len(pend)} batch(es) — re-run fetch later:")
        for bid,stt,rc in pend: print(f"     {bid}: {stt} {rc}")
    else:
        print("   all batches ended. Next: python3 trope-form.py finalize")

if __name__=="__main__":
    if MODE=="submit": submit()
    elif MODE=="fetch": fetch()
    else: sys.exit("usage: trope-gate-batch.py [submit|fetch] [--chunk 2000]")
