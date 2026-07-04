#!/usr/bin/env python3
"""Concept canonicalisation (Phase 1, connections overhaul).

Maps free-text takes.concept variants (~10.8k distinct) onto canonical
sm_concepts rows (1,227) and materialises the result in concept_map:
  1. exact:  raw_l == sm_concepts.name_l                      -> sim 1.0
  2. embed:  text-embedding-3-small cosine nearest neighbour  -> sim >= threshold

Usage:
  python3 concept-embed.py            # report only: histogram + boundary samples
  python3 concept-embed.py --write 0.72   # upsert concept_map rows at threshold
Embeddings are cached in worker/.concept_embed_cache.json so the report and
write runs embed only once. Requires OPENAI_API_KEY + SUPABASE_SERVICE_ROLE_KEY.
"""
import os, sys, json, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, ".concept_embed_cache.json")

def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
OAI = os.environ.get("OPENAI_API_KEY")
if not (URL and KEY and OAI): print("Missing env"); sys.exit(1)

def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    for k, v in h.items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]

def fetch_all(path):
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"{path}&limit=1000&offset={off}")
        if st != 200: raise RuntimeError(f"{st}: {tx[:200]}")
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    return rows

def embed(texts, batch=256):
    out = []
    for i in range(0, len(texts), batch):
        chunk = texts[i:i + batch]
        req = urllib.request.Request("https://api.openai.com/v1/embeddings", method="POST",
                                     data=json.dumps({"model": "text-embedding-3-small", "input": chunk}).encode())
        req.add_header("Authorization", f"Bearer {OAI}"); req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read().decode())
        out += [d["embedding"] for d in data["data"]]
        print(f"[concept] embedded {min(i + batch, len(texts))}/{len(texts)}", flush=True)
    return out

def main():
    write_thresh = None
    if "--write" in sys.argv:
        write_thresh = float(sys.argv[sys.argv.index("--write") + 1])

    canon = fetch_all("sm_concepts?select=id,name,name_l,native&order=id")
    raws = fetch_all("takes?select=concept&status=eq.published&concept=not.is.null&order=id")
    raw_set = {}
    for r in raws:
        c = (r["concept"] or "").strip()
        if not c: continue
        raw_set.setdefault(c.lower(), c)
    raw_l = sorted(raw_set.keys())
    name_l = {c["name_l"]: c["id"] for c in canon if c.get("name_l")}
    print(f"[concept] canon={len(canon)} raw_distinct={len(raw_l)}")

    exact = {rl: name_l[rl] for rl in raw_l if rl in name_l}
    todo = [rl for rl in raw_l if rl not in exact]
    print(f"[concept] exact={len(exact)} to_embed={len(todo)}")

    if os.path.exists(CACHE):
        cache = json.load(open(CACHE))
        print("[concept] using cached matches")
    else:
        import numpy as np
        canon_texts = [c["name"] + (f" / {c['native']}" if c.get("native") else "") for c in canon]
        cv = np.array(embed(canon_texts), dtype=np.float32)
        cv /= np.linalg.norm(cv, axis=1, keepdims=True)
        rv = np.array(embed([raw_set[rl] for rl in todo]), dtype=np.float32)
        rv /= np.linalg.norm(rv, axis=1, keepdims=True)
        sims = rv @ cv.T
        best = sims.argmax(axis=1); bsim = sims.max(axis=1)
        cache = {rl: [canon[int(b)]["id"], float(s), canon[int(b)]["name"]]
                 for rl, b, s in zip(todo, best, bsim)}
        json.dump(cache, open(CACHE, "w"))
        print(f"[concept] cached -> {CACHE}")

    bands = [(0.9, 1.01), (0.8, 0.9), (0.75, 0.8), (0.7, 0.75), (0.65, 0.7), (0.6, 0.65), (0.0, 0.6)]
    for lo, hi in bands:
        rows = [(rl, v) for rl, v in cache.items() if lo <= v[1] < hi]
        print(f"\n== band [{lo},{hi}): {len(rows)}")
        for rl, v in sorted(rows, key=lambda x: -x[1][1])[:6]:
            print(f"   {v[1]:.3f}  {raw_set[rl][:48]!r:50} -> {v[2][:48]!r}")

    if write_thresh is None:
        print("\n[concept] report only — re-run with --write <threshold> to upsert")
        return

    rows = [{"raw_l": rl, "concept_id": cid, "sim": 1.0, "method": "exact"}
            for rl, cid in exact.items()]
    rows += [{"raw_l": rl, "concept_id": v[0], "sim": round(v[1], 4), "method": "embed"}
             for rl, v in cache.items() if v[1] >= write_thresh]
    print(f"[concept] upserting {len(rows)} rows (exact {len(exact)} + embed {len(rows) - len(exact)})")
    for i in range(0, len(rows), 300):
        st, tx = sb("POST", "concept_map?on_conflict=raw_l", rows[i:i + 300],
                    prefer="resolution=merge-duplicates,return=minimal")
        if st >= 300: print(f"[concept] upsert {st}: {tx[:200]}"); sys.exit(1)
    print("[concept] done")

if __name__ == "__main__": main()
