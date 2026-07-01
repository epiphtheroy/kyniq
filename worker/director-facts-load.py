#!/usr/bin/env python3
"""director-facts-load — write The Life facts into director_facts.

Reads worker/director-facts-all.jsonl ({slug, name_meaning, intro, facts:[{n,text,source}]}) and
upserts one director_facts row per director. DRY by default; --apply writes.

Usage: python3 director-facts-load.py --out worker/director-facts-all [--apply]
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
OUT = args[args.index("--out") + 1] if "--out" in args else "worker/director-facts-all"
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

def main():
    if not os.path.exists(SRC): sys.exit(f"missing {SRC} — run director-facts-gen.py --all first")
    rows = []
    for l in open(SRC, encoding="utf-8"):
        l = l.strip()
        if not l: continue
        d = json.loads(l)
        facts = [{"n": f.get("n"), "text": f.get("text"), "source": f.get("source")} for f in d.get("facts", []) if f.get("text")]
        if not facts: continue
        rows.append({"director_slug": d["slug"], "name_meaning": d.get("name_meaning", ""),
                     "intro": d.get("intro", ""), "facts": facts})
    # jsonl is append-mode (a director re-run appears more than once) — dedupe by slug, newest wins,
    # otherwise a duplicate inside a batch makes the whole batch INSERT fail with a 23505 conflict.
    _dedup = {}
    for r in rows: _dedup[r["director_slug"]] = r
    rows = list(_dedup.values())
    nfacts = sum(len(r["facts"]) for r in rows)
    print(f"[director-facts-load] {'APPLY' if APPLY else 'DRY'} · directors {len(rows)} · facts {nfacts} (avg {nfacts/max(1,len(rows)):.1f})")
    for r in rows[:5]:
        print(f"   {r['director_slug']}: {len(r['facts'])} facts")
    if not APPLY:
        print("\nDRY — no writes. Re-run with --apply.")
        return
    slugs = [r["director_slug"] for r in rows]
    def inlist(v): return "(" + ",".join(f'"{x}"' for x in v) + ")"
    for i in range(0, len(slugs), 80):
        http("DELETE", f"{URL}/rest/v1/director_facts?director_slug=in.{inlist(slugs[i:i+80])}", {**sbh(), "Prefer": "return=minimal"})
    n = 0
    for i in range(0, len(rows), 200):
        c = rows[i:i+200]
        st, tx = http("POST", f"{URL}/rest/v1/director_facts", {**sbh(), "Prefer": "return=minimal"}, c)
        if st >= 300: print(f"  ! insert {st}: {tx[:160]}")
        else: n += len(c)
    print(f"\n✅ wrote {n} director_facts rows. Live within ISR (~5 min).")

if __name__ == "__main__":
    main()
