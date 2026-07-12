#!/usr/bin/env python3
"""Batch figure extraction via the Anthropic Message Batches API (≈50% cheaper, async).

Two phases:
  --submit : one batch request per figure-less film → POST to the Batches API →
             save the batch id to worker/film-extract-batch.json. Returns immediately
             (you can close the laptop). Anthropic processes async (usually < a few
             hours, max 24h).
  --fetch  : poll the batch; when it has ENDED, download the results and PERSIST
             figures + takes — identical logic/quality to film-extract.py. Idempotent:
             films that already have figures are skipped, so re-running is safe.

Reuses film-extract.py's exact SYSTEM prompt, build_user, persist, norm_kind, REGISTERS
(loaded as a module), so batch output matches the validated pilot.

Usage:
  python3 film-extract-batch.py --submit [--limit N]
  python3 film-extract-batch.py --fetch                 # poll + persist when ready
  python3 film-extract-batch.py --fetch --dry           # when ready: write bundle JSON, NO DB
  python3 film-extract-batch.py --fetch --batch msgbatch_xxx
"""
import os, sys, json, time, urllib.request, urllib.error, urllib.parse, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
# Load film-extract.py (hyphenated filename) as module `fe` — reuses its SYSTEM/build_user/persist/etc.
_spec = importlib.util.spec_from_file_location("film_extract", os.path.join(HERE, "film-extract.py"))
fe = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(fe)

ANT = os.environ.get("ANTHROPIC_API_KEY")
if not (ANT and fe.URL and fe.KEY):
    print("Missing env (ANTHROPIC_API_KEY + Supabase url/service key in worker/.env.local)"); sys.exit(1)

args = sys.argv[1:]
SUBMIT = "--submit" in args
FETCH = "--fetch" in args
DRY = "--dry" in args
LIMIT = int(args[args.index("--limit") + 1]) if "--limit" in args else 100000
BATCH = args[args.index("--batch") + 1] if "--batch" in args else None
MODEL = "claude-opus-4-8"
STATE = os.path.join(HERE, "film-extract-batch.json")
OUTB = os.path.join(HERE, "film-extract-batch.bundle.json")
API = "https://api.anthropic.com/v1/messages/batches"

def http(method, url, body=None, timeout=300):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("x-api-key", ANT); req.add_header("anthropic-version", "2023-06-01"); req.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:800]

def figure_less_films():
    fig_ids = {r["film_id"] for r in fe.fetch_all("figures?select=film_id")}
    sel = "id,slug,title,year,director,overview,genres,tmdb_extra"
    films = fe.fetch_all(f"films?select={urllib.parse.quote(sel, safe=',')}&tmdb_id=not.is.null")
    return [f for f in films if f["id"] not in fig_ids]

def clean_figure(fo, pool_slugs, fseen):
    """Same dedupe/validation as film-extract.main, returns (fslug, clean_takes) or (None,None)."""
    label = (fo.get("label") or "").strip()
    if not label: return None, None
    fslug = fe.slugify(label)
    if fslug in fseen: return None, None
    seen_reg, seen_mt, clean = set(), set(), []
    for t in fo.get("takes", []):
        reg = t.get("register")
        if reg not in fe.REGISTERS or reg in seen_reg: continue
        if not (t.get("evidence") and t.get("rationale")): continue
        mt = t.get("metatake") or {}
        if mt.get("ref") and mt["ref"] not in pool_slugs:
            mt = {"new": {"title": mt["ref"].replace("-", " ").title(), "laconic": ""}}; t["metatake"] = mt
        key = mt.get("ref") or json.dumps(mt.get("new") or {}, sort_keys=True)
        if not key or key in seen_mt: continue
        seen_reg.add(reg); seen_mt.add(key); clean.append(t)
    if not clean: return None, None
    return fslug, clean

def submit():
    pool = fe.fetch_all("meta_takes?select=slug,title,laconic&status=eq.published&kind=eq.reading")
    targets = figure_less_films()
    # --films slug,slug : scope the batch to specific films (factory per-run scoping, §7.13).
    # Backward-compatible: absent -> unchanged (all figure-less films). Prevents the ~$1500
    # mis-fire where an unscoped --submit sweeps in ~5,000 figure-less Tier-2 films.
    if "--films" in args:
        want = {s.strip() for s in args[args.index("--films") + 1].split(",") if s.strip()}
        targets = [f for f in targets if f.get("slug") in want]
    targets = targets[:LIMIT]
    print(f"[batch submit] {len(targets)} figure-less films | reading pool {len(pool)} | model {MODEL}")
    if not targets: print("  nothing to do (all films have figures)."); return
    reqs = [{"custom_id": f["id"],
             "params": {"model": MODEL, "max_tokens": 20000, "system": fe.SYSTEM,
                        "messages": [{"role": "user",
                                      "content": fe.build_user(f, pool, []) + "\n\nReturn ONLY the raw JSON object — no markdown fences, no prose."}]}}
            for f in targets]
    st, tx = http("POST", API, {"requests": reqs})
    if st >= 300: print(f"  ! submit failed {st}: {tx}"); sys.exit(1)
    d = json.loads(tx); bid = d.get("id")
    json.dump({"batch_id": bid, "count": len(reqs), "submitted_at": time.time()}, open(STATE, "w"))
    print(f"\n✅ Submitted batch {bid}  ({len(reqs)} films). status={d.get('processing_status')}")
    print(f"   Saved id → {os.path.basename(STATE)}. You can close the laptop.")
    print("   Later: run the FETCH command to persist results (usually ready in < a few hours; max 24h).")

def fetch():
    bid = BATCH or (json.load(open(STATE)).get("batch_id") if os.path.exists(STATE) else None)
    if not bid: print("No batch id — run --submit first, or pass --batch msgbatch_xxx"); sys.exit(1)
    st, tx = http("GET", f"{API}/{bid}")
    if st >= 300: print(f"  ! status check {st}: {tx}"); sys.exit(1)
    d = json.loads(tx); ps = d.get("processing_status"); rc = d.get("request_counts", {})
    print(f"[batch {bid}] status={ps} counts={rc}")
    if ps != "ended":
        print("  Not ready yet — re-run this command later (it just polls)."); return
    st, body = http("GET", d.get("results_url"))
    if st >= 300: print(f"  ! results download {st}: {body[:300]}"); sys.exit(1)

    pool = fe.fetch_all("meta_takes?select=slug,title,laconic&status=eq.published&kind=eq.reading")
    pool_slugs = {m["slug"] for m in pool}
    have_ids = {r["film_id"] for r in fe.fetch_all("figures?select=film_id")}
    nfig = ntake = ncand = err = skip = 0; bundle = []
    for line in body.splitlines():
        if not line.strip(): continue
        rec = json.loads(line); fid = rec.get("custom_id"); res = rec.get("result", {})
        if res.get("type") != "succeeded": err += 1; continue
        if fid in have_ids and not DRY: skip += 1; continue   # idempotent: already has figures
        text = "".join(p.get("text", "") for p in res.get("message", {}).get("content", []) if p.get("type") == "text")
        out = fe.parse(text) or {}
        fseen = set(); brec = {"film_id": fid, "figures": []}
        for fo in out.get("figures", []):
            fslug, clean = clean_figure(fo, pool_slugs, fseen)
            if not fslug: continue
            fseen.add(fslug)
            if DRY:
                brec["figures"].append({**fo, "slug": fslug, "takes": clean})
            else:
                ncand += fe.persist({"id": fid}, fo, fslug, clean, pool_slugs)
            nfig += 1; ntake += len(clean)
        if DRY: bundle.append(brec)
    if DRY:
        json.dump({"batch": bid, "films": bundle}, open(OUTB, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"\n[DRY] {nfig} figures / {ntake} takes across {len(bundle)} films → {os.path.basename(OUTB)} (no DB writes). errors={err}")
    else:
        print(f"\n✅ Persisted {nfig} figures / {ntake} takes ({ncand} new hub candidates). errors={err} skipped(already had figures)={skip}")
        print("   Any errored/expired films stay figure-less — resubmit (--submit) + --fetch to fill, or run film-extract.py for stragglers.")
        print("   Next: mt-embed → mt-consolidate → mt-author → mt-rank → mt-recommend → trope-* → theory-*.")

def main():
    if SUBMIT: submit()
    elif FETCH: fetch()
    else: print("Specify --submit or --fetch"); sys.exit(1)

if __name__ == "__main__": main()
