#!/usr/bin/env python3
"""director-picks-load — write 'Where to Start' into director_picks.

Reads worker/director-picks-all.jsonl ({slug, picks:[{slug,label,reason}]}). For each pick it validates
the film slug against the DB filmography (must be a VISIBLE film belonging to that director) and resolves
film_id / film_title / film_year, then upserts ordered director_picks rows.

DRY by default (stats + samples). --apply writes (replaces existing rows for the affected directors).

Usage: python3 director-picks-load.py --out worker/director-picks-all [--apply]
"""
import os, sys, json, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
args = sys.argv[1:]
APPLY = "--apply" in args
OUT = args[args.index("--out") + 1] if "--out" in args else "worker/director-picks-all"
SRC = OUT if OUT.endswith(".jsonl") else OUT + ".jsonl"
if not (URL and KEY): sys.exit("Missing SUPABASE env")

def http(method, url, headers=None, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    if body is not None: req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
def sbh(): return {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
def sb_get(path):
    rows, off = [], 0
    while True:
        st, tx = http("GET", f"{URL}/rest/v1/{path}&limit=1000&offset={off}", sbh())
        if st != 200: raise RuntimeError(f"{st}: {tx[:160]}")
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    return rows

def main():
    if not os.path.exists(SRC): sys.exit(f"missing {SRC} — run director-picks-batch.py fetch first")
    # full visible filmography: slug -> {id,title,year,director_slug}
    films = sb_get("films?select=id,slug,title,year,director_slug&visible=eq.true")
    fidx = {f["slug"]: f for f in films if f.get("slug")}

    items = [json.loads(l) for l in open(SRC, encoding="utf-8") if l.strip()]
    rows = []; n_drop = 0; samples = []
    for it in items:
        dslug = it["slug"]; pos = 0; seen = set()
        for p in (it.get("picks") or []):
            fs = (p.get("slug") or "").strip()
            f = fidx.get(fs)
            if not f or f.get("director_slug") != dslug or fs in seen:
                n_drop += 1; continue           # not in DB / wrong director / duplicate
            seen.add(fs); pos += 1
            row = {"director_slug": dslug, "pos": pos, "film_id": f["id"], "film_slug": fs,
                   "film_title": f["title"], "film_year": f.get("year"),
                   "label": (p.get("label") or "").strip() or None, "reason": (p.get("reason") or "").strip() or None}
            rows.append(row)
            if len(samples) < 12: samples.append(row)

    ndir = len(set(r["director_slug"] for r in rows))
    print(f"[director-picks-load] {'APPLY' if APPLY else 'DRY'} · directors {ndir} · pick rows {len(rows)} · dropped {n_drop}")
    print("  — sample —")
    for s in samples:
        print(f"    [{s['director_slug']}] #{s['pos']} {s['label']}: {s['film_title']} ({s['film_year'] or '?'})")
    if not APPLY:
        print("\nDRY — no writes. Re-run with --apply to write director_picks.")
        return
    slugs = sorted(set(r["director_slug"] for r in rows))
    def inlist(v): return "(" + ",".join(f'"{x}"' for x in v) + ")"
    for i in range(0, len(slugs), 80):
        http("DELETE", f"{URL}/rest/v1/director_picks?director_slug=in.{inlist(slugs[i:i+80])}", {**sbh(), "Prefer": "return=minimal"})
    n = 0
    for i in range(0, len(rows), 500):
        c = rows[i:i+500]
        st, tx = http("POST", f"{URL}/rest/v1/director_picks", {**sbh(), "Prefer": "return=minimal"}, c)
        if st >= 300: print(f"  ! insert {st}: {tx[:160]}")
        else: n += len(c)
    print(f"\n✅ wrote {n} director_picks rows across {ndir} directors. 'Where to Start' live within ISR (~5 min).")

if __name__ == "__main__":
    main()
