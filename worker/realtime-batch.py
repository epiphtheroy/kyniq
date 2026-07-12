#!/usr/bin/env python3
"""realtime-batch — the SYNC twin of the *-batch.py submit/fetch pair (factory test runs).

Reads {OUT}.requests.jsonl (the standard Anthropic-batch request lines every *-gen.py emits),
calls /v1/messages DIRECTLY in parallel (no Batches API, no polling latency), and appends
{"slug": custom_id, **parse_json(model_text)} lines to {OUT}.jsonl — a superset of what every
*-batch.py fetch writes ({"slug", "lenses"} / {"slug", "recs"} / {"slug", "invitation", "takes"} /
{"slug", "portrait", "next"} / {"slug", "picks"}), so the downstream load/resolve steps read it
unchanged. Failures go to {OUT}.failures.jsonl, same as bold-take-batch.

Owner rule (memory: small-tests-sync-not-batch): pilots/probes run realtime; only bulk runs batch.
Cost is FULL price (no 50% batch discount) — the executor only auto-picks this for small runs.

  python3 realtime-batch.py --out factory-asset-12 [--fanout 6]
"""
import os, sys, json, re, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

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
def argf(f, d): return type(d)(args[args.index(f) + 1]) if f in args else d
OUT = argf("--out", "")
if not OUT: sys.exit("--out NAME required (reads NAME.requests.jsonl)")
FANOUT = argf("--fanout", int(os.environ.get("FACTORY_SYNC_FANOUT", "6")))
HDR = {"x-api-key": ANT, "anthropic-version": "2023-06-01", "content-type": "application/json"}
API = "https://api.anthropic.com/v1/messages"

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

def call(params, tries=5):
    body = json.dumps(params).encode()
    for i in range(tries):
        req = urllib.request.Request(API, method="POST", data=body)
        for k, v in HDR.items(): req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            code = e.code; detail = e.read().decode()[:300]
            if code in (429, 500, 502, 503, 529) and i < tries - 1:
                time.sleep(min(60, 2 ** (i + 2))); continue
            raise RuntimeError(f"HTTP {code}: {detail}")
        except Exception as e:
            if i < tries - 1: time.sleep(min(60, 2 ** (i + 2))); continue
            raise

def main():
    reqpath = f"{OUT}.requests.jsonl"
    if not os.path.exists(reqpath): sys.exit(f"missing {reqpath} — run the *-gen.py emit step first")
    reqs = [json.loads(l) for l in open(reqpath, encoding="utf-8") if l.strip()]
    full = f"{OUT}.jsonl"; done = set()
    if os.path.exists(full):
        for l in open(full, encoding="utf-8"):
            try: done.add(json.loads(l).get("slug"))
            except Exception: pass
    todo = [r for r in reqs if r.get("custom_id") and r["custom_id"] not in done]
    print(f"[realtime] {len(reqs)} requests · {len(done)} already done · {len(todo)} to call · fanout {FANOUT}")
    if not todo: print("✅ nothing to do"); return
    fh = open(full, "a", encoding="utf-8"); ff = None
    tin = tout = got = err = 0
    def one(r):
        msg = call(r["params"])
        text = "".join(p.get("text", "") for p in msg.get("content", []) if p.get("type") == "text")
        return r["custom_id"], parse_json(text), msg.get("usage", {})
    with ThreadPoolExecutor(max_workers=FANOUT) as ex:
        futs = {ex.submit(one, r): r["custom_id"] for r in todo}
        for f in as_completed(futs):
            cid = futs[f]
            try:
                cid, parsed, u = f.result()
                if not isinstance(parsed, dict): raise ValueError(f"model returned non-object JSON ({type(parsed).__name__})")
                row = dict(parsed); row["slug"] = cid  # slug wins over any model-emitted "slug"
                fh.write(json.dumps(row, ensure_ascii=False) + "\n"); fh.flush()
                tin += u.get("input_tokens", 0); tout += u.get("output_tokens", 0); got += 1
                print(f"    ✓ {cid}")
            except Exception as e:
                err += 1; print(f"    ! {cid}: {str(e)[:200]}")
                ff = ff or open(f"{OUT}.failures.jsonl", "a", encoding="utf-8")
                ff.write(json.dumps({"slug": cid, "reason": "realtime_fail", "error": str(e)[:300]}, ensure_ascii=False) + "\n"); ff.flush()
    fh.close(); ff and ff.close()
    print(f"\n✅ realtime {got}/{len(todo)} ok · errors {err} · in {tin} out {tout} tokens (full price, no batch discount)")
    if err: sys.exit(1)

if __name__ == "__main__":
    main()
