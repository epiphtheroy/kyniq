#!/usr/bin/env python3
"""next-batch — submit & fetch "Watch next" generation via Anthropic Message Batches (≈50% off).
Pairs with next-gen.py:
  1) python3 next-gen.py --emit-requests --all --out next-all   → next-all.requests.jsonl
  2) python3 next-batch.py submit --out next-all  [--chunk 1000]
  3) python3 next-batch.py fetch  --out next-all   → next-all.jsonl  ({slug, recs:[9]})  (re-run until ended)
"""
import os, sys, json, re, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
ANT = os.environ.get("ANTHROPIC_API_KEY")
if not ANT: sys.exit("Missing ANTHROPIC_API_KEY")
args = sys.argv[1:]
MODE = args[0] if args and not args[0].startswith("-") else ""
def argf(f, d): return type(d)(args[args.index(f) + 1]) if f in args else d
OUT = args[args.index("--out") + 1] if "--out" in args else "next-all"
CHUNK = argf("--chunk", 1000)
PRICE_IN, PRICE_OUT = 3.0, 15.0           # Sonnet 4.6; batch = 50%
HDR = {"x-api-key": ANT, "anthropic-version": "2023-06-01", "content-type": "application/json"}
API = "https://api.anthropic.com/v1/messages/batches"

def http(method, url, headers=None, body=None, timeout=300):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:800]

def parse_json(s):
    s = s.strip()
    if s.startswith("```"): s = re.sub(r"^```[a-z]*\n?", "", s); s = re.sub(r"\n?```$", "", s)
    start = s.find("{")
    if start < 0: return json.loads(s)
    depth = 0; instr = False; esc = False
    for k in range(start, len(s)):
        ch = s[k]
        if instr:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == '"': instr = False
        elif ch == '"': instr = True
        elif ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0: return json.loads(s[start:k + 1])
    return json.loads(s[start:])

def submit():
    reqpath = f"{OUT}.requests.jsonl"
    if not os.path.exists(reqpath): sys.exit(f"missing {reqpath} — run next-gen.py --emit-requests --all --out {OUT}")
    reqs = [json.loads(l) for l in open(reqpath, encoding="utf-8") if l.strip()]
    if not reqs: sys.exit("no requests")
    print(f"[submit] {len(reqs)} requests · chunk={CHUNK}")
    ids = []
    for i in range(0, len(reqs), CHUNK):
        part = reqs[i:i + CHUNK]
        st, tx = http("POST", API, HDR, {"requests": part})
        if st >= 300: print(f"  ! submit {st}: {tx[:300]}"); break
        bid = json.loads(tx).get("id"); ids.append(bid)
        print(f"  ✓ batch {bid} ({len(part)})"); time.sleep(1)
    if ids:
        with open(f"{OUT}.batchids.txt", "a", encoding="utf-8") as f: f.write("\n".join(ids) + "\n")
        print(f"✅ {len(ids)} batch(es) → {OUT}.batchids.txt\n   fetch: python3 next-batch.py fetch --out {OUT}")

def fetch():
    idpath = f"{OUT}.batchids.txt"
    if not os.path.exists(idpath): sys.exit(f"missing {idpath} — submit first")
    ids = [l.strip() for l in open(idpath, encoding="utf-8") if l.strip()]
    full = f"{OUT}.jsonl"
    done = set()
    if os.path.exists(full):
        for l in open(full, encoding="utf-8"):
            try: done.add(json.loads(l).get("slug"))
            except Exception: pass
    fh = open(full, "a", encoding="utf-8")
    tin = tout = got = err = 0; pend = []
    for bid in ids:
        st, tx = http("GET", f"{API}/{bid}", HDR)
        if st >= 300: print(f"  ! {bid} {st}"); continue
        o = json.loads(tx); status = o.get("processing_status"); rc = o.get("request_counts", {})
        if status != "ended": pend.append((bid, status, rc)); print(f"  … {bid}: {status} {rc}"); continue
        st2, body = http("GET", o.get("results_url"), HDR)
        if st2 >= 300: print(f"  ! {bid} results {st2}"); continue
        for line in body.splitlines():
            line = line.strip()
            if not line: continue
            try: r = json.loads(line)
            except Exception: continue
            cid = r.get("custom_id"); res = r.get("result", {})
            if not cid or cid in done: continue
            if res.get("type") != "succeeded": err += 1; continue
            msg = res.get("message", {}); u = msg.get("usage", {})
            tin += u.get("input_tokens", 0); tout += u.get("output_tokens", 0)
            text = "".join(p.get("text", "") for p in msg.get("content", []) if p.get("type") == "text")
            try: recs = parse_json(text).get("recs", [])
            except Exception: err += 1; print(f"    ! {cid}: parse fail"); continue
            fh.write(json.dumps({"slug": cid, "recs": recs}, ensure_ascii=False) + "\n"); fh.flush()
            done.add(cid); got += 1
    fh.close()
    cost = (tin / 1e6 * PRICE_IN + tout / 1e6 * PRICE_OUT) * 0.5
    print(f"\n✅ fetched {got} films · batch cost ${cost:,.2f} · errors {err} · total {len(done)}")
    if pend:
        print(f"   still processing {len(pend)} — re-run fetch later:")
        for bid, stt, rc in pend: print(f"     {bid}: {stt} {rc}")

if __name__ == "__main__":
    if MODE == "submit": submit()
    elif MODE == "fetch": fetch()
    else: sys.exit("usage: next-batch.py [submit|fetch] --out next-all")
