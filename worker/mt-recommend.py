#!/usr/bin/env python3
"""Film recommendations (build step 4c) — film_affinities hybrid rebuild.

2026-07-04 REWRITE (connections overhaul, docs/PLAN-connections-overhaul.md):
The old version computed TF-IDF over takes.meta_take_id, which has been dead
since the trope reformation (all rows point at unpublished hubs) — re-running
it wiped film_affinities and wrote 0 rows. The rebuild now lives in SQL
(supabase/rpc/conn_rebuild.sql, applied as migration conn_rebuild_rpcs):

  score = RRF( trope TF-IDF rank  [figure_type_members, published tropes],
               embedding cosine rank [film_taste_vector, top-30/film] ),
  top-24 per film; shared_meta_take_ids = shared trope ids (rarest first).

This script just drives the chunked RPCs (each call < REST 8s timeout):
  conn_rebuild_stage_truncate → conn_stage_tfidf_chunk* → conn_stage_knn_chunk*
  → conn_affinities_swap (atomic truncate+insert).
Idempotent — safe to re-run. Requires SUPABASE_SERVICE_ROLE_KEY.
Usage: python3 mt-recommend.py
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
if not (URL and KEY): print("Missing env"); sys.exit(1)

def rpc(name, body=None):
    req = urllib.request.Request(f"{URL}/rest/v1/rpc/{name}", method="POST",
                                 data=json.dumps(body or {}).encode())
    for k, v in {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]

def run_chunks(fn, chunk=250):
    total = 0; off = 0
    while True:
        st, tx = rpc(fn, {"p_offset": off, "p_limit": chunk})
        if st >= 300: print(f"[recommend] {fn} offset={off} -> {st}: {tx}"); sys.exit(1)
        n = int(tx)
        total += n; off += chunk
        print(f"[recommend] {fn} offset={off - chunk}: +{n} rows", flush=True)
        if n == 0: break
    return total

def main():
    st, tx = rpc("conn_rebuild_stage_truncate")
    if st >= 300: print(f"[recommend] truncate -> {st}: {tx}"); sys.exit(1)
    print("[recommend] staging truncated")
    t = run_chunks("conn_stage_tfidf_chunk")
    print(f"[recommend] tfidf pairs: {t}")
    k = run_chunks("conn_stage_knn_chunk")
    print(f"[recommend] knn rows: {k}")
    st, tx = rpc("conn_affinities_swap")
    if st >= 300: print(f"[recommend] swap -> {st}: {tx}"); sys.exit(1)
    print(f"[recommend] done: film_affinities rows = {tx}")

if __name__ == "__main__": main()
