#!/usr/bin/env python3
"""Galaxy map build (Phase 3, connections overhaul).

Projects film_taste_vector (1536d, one per visible film) to 2D with t-SNE
(cosine metric, fixed seed 42 so rebuilds are reproducible), clusters with
KMeans, and upserts film_map_xy. Cluster labels (dominant distinctive genre,
top idf-weighted trope) are computed in SQL afterwards — run with --labels.

Usage:
  python3 galaxy-build.py            # fetch -> t-SNE -> KMeans -> upsert xy
  python3 galaxy-build.py --labels   # only refresh film_map_clusters labels
Requires SUPABASE_SERVICE_ROLE_KEY; scikit-learn (pip3 install --user scikit-learn).
"""
import os, sys, json, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
K = 14  # clusters

def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY): print("Missing env"); sys.exit(1)

def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    for k, v in h.items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=180) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]

def rpc(name, body=None):
    return sb("POST", f"rpc/{name}", body or {})

LABEL_SQL_NOTE = """
-- label refresh lives in supabase/rpc/galaxy.sql (galaxy_refresh_cluster_labels)
"""

def main():
    if "--labels" in sys.argv[1:]:
        st, tx = rpc("galaxy_refresh_cluster_labels")
        print(f"[galaxy] labels -> {st}: {tx[:200]}")
        return

    import numpy as np
    from sklearn.manifold import TSNE
    from sklearn.cluster import KMeans

    ids, vecs = [], []
    off = 0
    while True:
        st, tx = sb("GET", f"film_taste_vector?select=film_id,embedding&order=film_id&limit=200&offset={off}")
        if st != 200: print(f"[galaxy] fetch {st}: {tx[:200]}"); sys.exit(1)
        rows = json.loads(tx)
        for r in rows:
            ids.append(r["film_id"]); vecs.append(json.loads(r["embedding"]))
        if len(rows) < 200: break
        off += 200
        print(f"[galaxy] fetched {len(ids)} vectors", flush=True)

    X = np.array(vecs, dtype=np.float32)
    X /= np.linalg.norm(X, axis=1, keepdims=True)
    print(f"[galaxy] t-SNE on {X.shape[0]} films…", flush=True)
    xy = TSNE(n_components=2, metric="cosine", perplexity=30, init="pca",
              learning_rate="auto", random_state=42).fit_transform(X)
    # normalise to [-100, 100] for a stable client coordinate space
    xy = (xy - xy.mean(axis=0)) / (np.abs(xy).max() + 1e-9) * 100.0

    print("[galaxy] KMeans…", flush=True)
    cl = KMeans(n_clusters=K, n_init=10, random_state=42).fit_predict(xy.astype(np.float64))

    rows = [{"film_id": fid, "x": round(float(x), 3), "y": round(float(y), 3), "cluster": int(c)}
            for fid, (x, y), c in zip(ids, xy, cl)]
    for i in range(0, len(rows), 300):
        st, tx = sb("POST", "film_map_xy?on_conflict=film_id", rows[i:i + 300],
                    prefer="resolution=merge-duplicates,return=minimal")
        if st >= 300: print(f"[galaxy] upsert {st}: {tx[:200]}"); sys.exit(1)
    print(f"[galaxy] wrote {len(rows)} coordinates")

    st, tx = rpc("galaxy_refresh_cluster_labels")
    print(f"[galaxy] labels -> {st}: {tx[:200]}")

if __name__ == "__main__": main()
