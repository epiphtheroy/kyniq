#!/usr/bin/env python3
"""
Phase 0 FINALIZER (REST edition) — authoritative origin country from TMDB.

Same job as phase0_origin_backfill.py, but needs **no** SUPABASE_DB_URL and **no** pip installs.
It talks to Supabase over the REST API using values already in your .env.local, and to TMDB with
your read token. Standard-library only (urllib) — just double-click run-phase0-finalize.command.

Reads from ~/Documents/MetaTake/.env.local (or ./.env.local):
  TMDB_READ_TOKEN               TMDB v4 read token (Bearer)
  NEXT_PUBLIC_SUPABASE_URL      https://<ref>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY     service role key (server-side; bypasses RLS)

Idempotent; respects manual_override; ~4k–7k TMDB calls (~4 min). Re-running only re-checks
films not yet marked origin_confidence='api', so it resumes safely.
"""
import os, sys, json, time, pathlib, urllib.request, urllib.error

def load_env():
    for p in [".env.local", os.path.expanduser("~/Documents/MetaTake/.env.local")]:
        f = pathlib.Path(p)
        if f.exists():
            for line in f.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env()

def need(k):
    v = os.environ.get(k)
    if not v:
        print(f"ERROR: {k} not found in .env.local", file=sys.stderr); sys.exit(1)
    return v

TMDB_TOKEN = need("TMDB_READ_TOKEN")
SB_URL     = need("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
SB_KEY     = need("SUPABASE_SERVICE_ROLE_KEY")
REST       = SB_URL + "/rest/v1"
# TMDB auth: a v4 read token is a long JWT (use Bearer); a v3 key is 32 hex chars (use ?api_key=)
TMDB_IS_V4 = TMDB_TOKEN.startswith("eyJ") or len(TMDB_TOKEN) > 40
TMDB_H     = {"Authorization": f"Bearer {TMDB_TOKEN}", "accept": "application/json"} if TMDB_IS_V4 else {"accept": "application/json"}
SB_H       = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json"}

def http(url, headers, data=None, method=None, timeout=20):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method or ("POST" if body else "GET"))
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw.strip() else None

def rpc(fn, payload):
    return http(f"{REST}/rpc/{fn}", SB_H, data=payload)

def tmdb_movie(tid):
    url = f"https://api.themoviedb.org/3/movie/{tid}"
    if not TMDB_IS_V4:
        url += f"?api_key={TMDB_TOKEN}"
    for attempt in range(2):
        try:
            return http(url, TMDB_H)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2); continue
            if e.code == 404:
                return None
            raise
    return None

def main():
    print("Connecting to Supabase, fetching target films …")
    ids = rpc("curation_origin_targets", {}) or []
    print(f"targets needing authoritative origin: {len(ids)}")
    if not ids:
        print("Nothing to do — all origins already finalized."); return

    batch, resolved, done = [], 0, 0
    def flush():
        nonlocal batch, resolved
        if batch:
            n = rpc("curation_set_origin", {"rows": batch})
            resolved += (n or 0)
            batch = []

    for i, tid in enumerate(ids, 1):
        try:
            j = tmdb_movie(tid)
            if j:
                pcs = j.get("production_countries") or []
                cc = pcs[0]["iso_3166_1"].lower() if pcs else None
                if cc:
                    batch.append({"t": tid, "cc": cc, "l": j.get("original_language")})
        except Exception as e:
            print(f"  skip {tid}: {e}", file=sys.stderr)
        done = i
        if len(batch) >= 300:
            flush()
        if i % 300 == 0:
            print(f"  {i}/{len(ids)} processed (resolved {resolved})")
        time.sleep(0.03)
    flush()

    print("Rebuilding country hubs from authoritative origin …")
    rpc("curation_rebuild_hubs", {})
    print(f"DONE. processed {done}/{len(ids)}; resolved {resolved} origins; country hubs rebuilt.")
    print("Next: tell your Metatake assistant to re-check curation_drift() and re-extract curation_hub.csv.")

if __name__ == "__main__":
    main()
