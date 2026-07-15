#!/usr/bin/env python3
"""tier2noindex.py — Tier-2 noindex factory (signal-recovery line). Repeatable orchestrator.

Goal: move noindex Tier-2 films across the index gate (lib/seo.ts filmIndexBar) by RECOVERING
free signals — it creates NO editorial content (no figures/takes/why/next). Canon: HANDOFF-티어2noindex공장.md.

MEASURED REALITY (2026-07-15 pilot n=100, do not re-litigate without new data):
  * reception (academic, OpenAlex) is the ONLY lever that crosses the gate — ~20% of addressable
    films reach reception>=3. This is the main step (pilot: 20/100 crossed, live).
  * awards (wd-honors, Wikidata) top out at 1-2 honors for Tier-2 → basically never reach the >=3
    threshold. It adds page content but ~0 crossings. Run it for substance, not for the index.
  * fpi_rebuild is a NO-OP for recovery (provider=0 films have empty film_watch_providers) — dropped.
  * only films WITH availability (n_providers>=1) are addressable; provider=0 films are gated by the
    availability baseline and left as-is (honest: they are not streaming-available per TMDB).
  * ⚠ SCALING CONSTRAINT — OpenAlex now meters a DAILY BUDGET ("Insufficient budget, $0 remaining"
    → HTTP 429). ~100-200 films/day of discovery exhausts it; the pilot alone drained today's. So the
    2,908 addressable films recover in DAILY WAVES over ~2-3 weeks (free), or faster with a paid
    OpenAlex key. Run `reception-wave` once/day; it fetches until the budget hits $0 then defers the
    rest (marks academic-pending) for the next day. NEVER delete cache to force a refetch — that drops
    already-fetched papers; --fill-academic only retries pending films and preserves fetched ones.

Subcommands:
  measure                      -> print the Tier-2 index snapshot (t2noindex_measure RPC)
  refresh                      -> rebuild the addressable cohort table (t2noindex_refresh RPC)
  slug-backfill                -> factory_director_slug_backfill over all null-slug films (bonus, not index)
  reception [--workers 3] [--limit N]  -> first-pass scoped academic discovery over the cohort + load
  reception-wave [--workers 2] -> daily budget-limited retry of academic-pending films (--fill-academic) + load
  awards [--limit N]           -> scoped wd-honors over the cohort (page content; ~0 crossings)
  revalidate                   -> ISR-revalidate cohort films that now pass the gate
  report [--baseline-idx N]    -> print/emit before-after; writes factory/logs/tier2noindex-<n>.md
  run [--workers 3]            -> refresh; slug-backfill; awards; reception+load; revalidate; report
"""
import os, sys, json, subprocess, time, hashlib, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAG = os.path.join(ROOT, "magazine research agent")
def load_env():
    for fn in (".env.local", ".env"):
        p = os.path.join(ROOT, fn)
        if os.path.exists(p):
            for line in open(p, encoding="utf-8"):
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env()
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"); KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SECRET = os.environ.get("REVALIDATION_SECRET", "")
H = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"}
args = sys.argv[2:] if len(sys.argv) > 1 else []
def argv(f, d=None, cast=str):
    return cast(args[args.index(f) + 1]) if f in args else d

def http(method, path, body=None, base=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request((base or URL) + path, method=method, data=data)
    for k, v in H.items(): req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode()

def rpc(fn, payload=None):
    st, tx = http("POST", f"/rest/v1/rpc/{fn}", payload or {})
    return json.loads(tx) if tx.strip() else None

def cohort_slugs():
    slugs, off = [], 0
    while True:
        st, tx = http("GET", f"/rest/v1/z_t2noindex_cohort?select=slug&order=slug&limit=1000&offset={off}")
        b = json.loads(tx); slugs += [r["slug"] for r in b]
        if len(b) < 1000: break
        off += 1000
    slugs.sort(key=lambda s: hashlib.md5(s.encode()).hexdigest())  # deterministic representative order
    return slugs

def sh(cmd, cwd=ROOT, env=None):
    e = dict(os.environ); e.update(env or {})
    print("  $", " ".join(cmd if isinstance(cmd, list) else [cmd]))
    return subprocess.run(cmd, cwd=cwd, env=e).returncode

def cmd_measure():
    print(json.dumps(rpc("t2noindex_measure"), indent=1));

def cmd_refresh():
    n = rpc("t2noindex_refresh"); print(f"cohort refreshed: {n} addressable noindex films")

def cmd_slug_backfill():
    # fill films.director_slug on exact ci-name matches to existing directors (bonus; does not affect index)
    n = rpc("factory_director_slug_backfill", {"p_ids": None}) if False else None
    # p_ids must be the null-slug set; compute it server-side via a tiny wrapper query is cleaner, but
    # the RPC takes an explicit array — pass the whole null-slug cohort:
    st, tx = http("GET", "/rest/v1/films?select=id&director_slug=is.null&director=not.is.null&limit=100000")
    ids = [r["id"] for r in json.loads(tx)]
    n = rpc("factory_director_slug_backfill", {"p_ids": ids})
    print(f"director_slug filled: {n}")

def cmd_reception():
    slugs = cohort_slugs()
    lim = argv("--limit", None, int)
    if lim: slugs = slugs[:lim]
    workers = argv("--workers", "3")
    print(f"reception (academic) sweep over {len(slugs)} films · workers {workers} · Brave OFF")
    # scoped discovery (BRAVE off => academic only, conserves Brave quota); then full idempotent load
    rc = sh(["python3", "reception-run.py", "--films", ",".join(slugs), "--workers", str(workers)],
            cwd=MAG, env={"BRAVE_API_KEY": ""})
    sh(["python3", "reception-load.py"], cwd=MAG)
    return rc

def cmd_reception_wave():
    # daily wave: retry academic-pending cached films against OpenAlex until the daily budget hits $0
    # (the pipeline circuit-breaks + defers the rest). Preserves already-fetched papers. Then load.
    workers = argv("--workers", "2")
    print(f"reception WAVE (--fill-academic) · workers {workers} · run once/day until addressable_noindex stops falling")
    sh(["python3", "reception-run.py", "--fill-academic", "--workers", str(workers)], cwd=MAG, env={"BRAVE_API_KEY": ""})
    sh(["python3", "reception-load.py"], cwd=MAG)

def cmd_awards():
    slugs = cohort_slugs()
    lim = argv("--limit", None, int)
    if lim: slugs = slugs[:lim]
    print(f"awards (wd-honors) sweep over {len(slugs)} films (page content; rarely crosses the gate)")
    # --all reaches visible=false Tier-2; --films scopes to the cohort
    return sh(["python3", "worker/wd-honors.py", "--all", "--films", ",".join(slugs)])

def cmd_revalidate():
    if not SECRET:
        print("no REVALIDATION_SECRET — skip"); return
    # cohort films that NOW pass the gate (reception/lineage/honors>=3 & providers>=1)
    slugs = []
    off = 0
    while True:
        st, tx = http("GET", f"/rest/v1/z_t2noindex_cohort?select=film_id,slug&limit=1000&offset={off}")
        b = json.loads(tx)
        if not b: break
        for r in b: slugs.append(r["slug"])
        if len(b) < 1000: break
        off += 1000
    # (the cohort table is the pre-sweep set; re-measure per-film would be ideal, but revalidating the
    #  whole prior cohort is safe/idempotent and guarantees any newly-crossed film's noindex meta drops)
    n = 0
    for s in slugs:
        try:
            http("POST", "/api/revalidate", {"secret": SECRET, "paths": [f"/film/{s}"], "tags": [f"film:{s}"]},
                 base="https://metatake.net")
            n += 1
        except Exception:
            pass
        if n % 200 == 0: time.sleep(1)
    print(f"revalidated {n} cohort film pages")

def cmd_report():
    snap = rpc("t2noindex_measure")
    base = argv("--baseline-idx", None, int)
    lines = ["# Tier-2 noindex factory — run report", "",
             f"idx_pass (Tier-2 indexed): {snap['idx_pass']}" + (f"  (baseline {base}, Δ +{snap['idx_pass']-base})" if base else ""),
             f"addressable noindex remaining: {snap['addressable_noindex']}",
             f"provider-blocked (availability, not addressable): {snap['provider_blocked']}",
             f"tier2 total: {snap['tier2_total']}", ""]
    out = os.path.join(ROOT, "factory", "logs", "tier2noindex-report.md")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w").write("\n".join(lines))
    print("\n".join(lines)); print("→", out)

def cmd_run():
    cmd_refresh(); cmd_slug_backfill(); cmd_awards(); cmd_reception(); cmd_revalidate(); cmd_report()

CMDS = {"measure": cmd_measure, "refresh": cmd_refresh, "slug-backfill": cmd_slug_backfill,
        "reception": cmd_reception, "reception-wave": cmd_reception_wave, "awards": cmd_awards,
        "revalidate": cmd_revalidate, "report": cmd_report, "run": cmd_run}
if __name__ == "__main__":
    c = sys.argv[1] if len(sys.argv) > 1 else "measure"
    if c not in CMDS:
        print(__doc__); sys.exit(2)
    CMDS[c]()
