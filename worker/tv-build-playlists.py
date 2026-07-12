#!/usr/bin/env python3
"""
tv-build-playlists.py — manifest stage S43 (big-3-axes) — §7.14 / WORKORDER §5c-4/§5d.

Drives the three BATCHED TV strategic-playlist builders over the Supabase
Management API with an offset-resume loop:

  tv_build_trope_playlists(p_min, p_batch:=300, p_offset)      ~2,859 lists (~10 calls)
  tv_build_concept_playlists(p_min, p_batch:=300, p_offset)    ~588 lists  (~2 calls)
  tv_build_archetype_playlists(p_min, p_batch:=300, p_offset)  ~1,535 lists (~6 calls)

Each function verified against 0060_tv_playlist_engine.sql:
  * signature (p_min int default 3, p_batch int default 300, p_offset int default 0)
  * self-takes advisory lock 777002 + statement_timeout '150s'; if the lock is
    held it returns {"locked": true} WITHOUT doing work (we back off + retry).
  * returns jsonb {"built": n, "axis": ..., "next_offset": p_offset+p_batch,
    "remaining": greatest(0, total-(p_offset+p_batch))}. remaining==0 => axis done.

The small axes (lineage/director/genre/country/decade/theorist/genre_topic) are NOT
handled here — those run via the single-call tv_build_all_playlists() (manifest
S43 runner.small). This script is runner.big only.

Between batches: time.sleep(20) + a fail-soft healthcheck GET of
https://metatake.net/api/surprise/home (log status/latency, keep going — the DB
builders are idempotent (on_conflict) so a hot site is never corrupted).

stdlib-only. No pip. Copies factory.py's load_env()/mgmt_query() pattern.

CLI:
  tv-build-playlists.py [--axes trope,concept,archetype] [--min N] [--batch N]
                        [--sleep S] [--dry]
"""
import os, sys, json, time, argparse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_REF = "jvgarcqrtsmgfimdcwgo"
HEALTHCHECK_URL = "https://metatake.net/api/surprise/home"
ADVISORY_LOCK = 777002  # the DB functions self-lock; we only observe {"locked":true}

# builders whose signature matches (p_min, p_batch, p_offset) and that return
# {built,next_offset,remaining}. Order = cheap→expensive is irrelevant (each is
# independent), but we keep the WORKORDER §5c-4 order for log familiarity.
AXIS_FN = {
    "trope":     "tv_build_trope_playlists",
    "concept":   "tv_build_concept_playlists",
    "archetype": "tv_build_archetype_playlists",
}
DEFAULT_AXES = ["trope", "concept", "archetype"]


# ----------------------------------------------------------------------------- env
def load_env():
    p = os.path.join(ROOT, ".env.local")
    if os.path.exists(p):
        for ln in open(p):
            ln = ln.strip()
            if "=" in ln and not ln.startswith("#"):
                k, v = ln.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


load_env()
SBP = os.environ.get("SUPABASE_ACCESS_TOKEN", "")


# ------------------------------------------------------------------- Management API
def mgmt_query(sql):
    """Run SQL via the Supabase Management API; returns list[dict] (or raises)."""
    if not SBP:
        raise RuntimeError("SUPABASE_ACCESS_TOKEN missing in .env.local")
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Authorization": f"Bearer {SBP}",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            out = r.read().decode()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"mgmt SQL error {e.code}: {e.read().decode()[:400]}")
    return json.loads(out) if out.strip() else []


# ------------------------------------------------------------------- healthcheck
def healthcheck():
    """Fail-soft GET of the surprise/home endpoint. Logs status + latency; never raises."""
    t0 = time.time()
    try:
        req = urllib.request.Request(HEALTHCHECK_URL, method="GET",
                                     headers={"User-Agent": "metatake-tv-build/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            dt = time.time() - t0
            code = r.getcode()
            log(f"  healthcheck {HEALTHCHECK_URL} -> {code} in {dt:.2f}s"
                + ("  SLOW>5s" if dt > 5 else ""))
            return code, dt
    except Exception as e:
        dt = time.time() - t0
        log(f"  healthcheck {HEALTHCHECK_URL} -> ERROR {e!r} in {dt:.2f}s (continuing)")
        return None, dt


# --------------------------------------------------------------------------- log
def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ----------------------------------------------------------------------- build axis
def build_axis(axis, fn, p_min, p_batch, sleep_s, dry):
    """Offset-resume loop for one big axis. Returns total built."""
    offset = 0
    total_built = 0
    call = 0
    log(f"=== axis '{axis}' via {fn}(p_min:={p_min}, p_batch:={p_batch}) ===")
    while True:
        call += 1
        sql = f"select public.{fn}({p_min}, {p_batch}, {offset}) as j;"
        if dry:
            log(f"  [DRY] would call {fn}(p_min:={p_min}, p_batch:={p_batch}, p_offset:={offset})")
            break
        rows = mgmt_query(sql)
        j = rows[0]["j"] if rows and rows[0].get("j") is not None else {}
        if isinstance(j, str):
            j = json.loads(j)

        # advisory-lock contention: the fn no-ops and returns {"locked": true}.
        # back off and retry the SAME offset (idempotent, no rows written).
        if j.get("locked"):
            log(f"  call#{call} offset={offset}: advisory lock {ADVISORY_LOCK} busy — "
                f"backing off {sleep_s}s, retrying same offset")
            time.sleep(sleep_s)
            call -= 1  # don't count a locked no-op as a real call
            continue

        built = j.get("built", 0)
        remaining = j.get("remaining")
        next_offset = j.get("next_offset", offset + p_batch)
        total_built += built
        log(f"  call#{call} offset={offset}: built={built} "
            f"next_offset={next_offset} remaining={remaining}")

        # remaining is None only if the fn returned an unexpected shape — stop safely.
        if remaining is None:
            log(f"  WARN: {fn} returned no 'remaining' — stopping axis to avoid a loop. "
                f"raw={json.dumps(j)[:200]}")
            break
        if remaining <= 0:
            log(f"  axis '{axis}' complete: {total_built} lists over {call} call(s)")
            break

        offset = next_offset
        time.sleep(sleep_s)
        healthcheck()
    return total_built


# --------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(prog="tv-build-playlists.py",
                                 description="Big-3-axes TV playlist batch runner (S43 §7.14).")
    ap.add_argument("--axes", default=",".join(DEFAULT_AXES),
                    help="comma list of axes to build (default: trope,concept,archetype)")
    ap.add_argument("--min", type=int, default=3, dest="p_min",
                    help="p_min membership threshold (default 3, matches 0060 default)")
    ap.add_argument("--batch", type=int, default=300, dest="p_batch",
                    help="p_batch entities per call (default 300, matches 0060 default)")
    ap.add_argument("--sleep", type=int, default=20, dest="sleep_s",
                    help="seconds to sleep between batches (default 20, per WORKORDER §5c-4)")
    ap.add_argument("--dry", action="store_true",
                    help="print the calls that would be made; do not touch the DB")
    a = ap.parse_args()

    axes = [x.strip() for x in a.axes.split(",") if x.strip()]
    unknown = [x for x in axes if x not in AXIS_FN]
    if unknown:
        print(f"unknown axes: {unknown}. valid: {list(AXIS_FN)}", file=sys.stderr)
        sys.exit(2)
    if not a.dry and not SBP:
        print("SUPABASE_ACCESS_TOKEN missing in .env.local", file=sys.stderr)
        sys.exit(1)

    log(f"tv-build-playlists start — axes={axes} p_min={a.p_min} p_batch={a.p_batch} "
        f"sleep={a.sleep_s}s dry={a.dry}")
    if not a.dry:
        healthcheck()  # baseline before we start writing

    grand = {}
    for axis in axes:
        built = build_axis(axis, AXIS_FN[axis], a.p_min, a.p_batch, a.sleep_s, a.dry)
        grand[axis] = built
        # a courtesy pause + healthcheck between axes (not counted per-batch)
        if not a.dry and axis != axes[-1]:
            time.sleep(a.sleep_s)
            healthcheck()

    log(f"DONE — built per axis: {json.dumps(grand)}")
    if not a.dry:
        total = mgmt_query("select count(*)::int c from public.tv_playlists;")[0]["c"]
        log(f"tv_playlists total rows now: {total}")


if __name__ == "__main__":
    main()
