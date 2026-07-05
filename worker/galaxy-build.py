#!/usr/bin/env python3
"""Galaxy map build (Phase 3, connections overhaul).

Projects taste vectors to 2D with t-SNE (cosine metric, fixed seed 42 so
rebuilds are reproducible), clusters with KMeans, and upserts the coordinate
tables. Cluster labels are computed in SQL afterwards.

Usage:
  python3 galaxy-build.py               # films: film_taste_vector -> film_map_xy (k=14)
  python3 galaxy-build.py --directors   # directors: director_embedding -> director_map_xy (k=10)
  python3 galaxy-build.py --labels      # only refresh film cluster labels
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

def project(vecs, k, perplexity=30):
    import numpy as np
    from sklearn.manifold import TSNE
    from sklearn.cluster import KMeans
    X = np.array(vecs, dtype=np.float32)
    X /= np.linalg.norm(X, axis=1, keepdims=True)
    print(f"[galaxy] t-SNE on {X.shape[0]} vectors…", flush=True)
    xy = TSNE(n_components=2, metric="cosine", perplexity=perplexity, init="pca",
              learning_rate="auto", random_state=42).fit_transform(X)
    # normalise to [-100, 100] for a stable client coordinate space
    xy = (xy - xy.mean(axis=0)) / (np.abs(xy).max() + 1e-9) * 100.0
    print("[galaxy] KMeans…", flush=True)
    cl = KMeans(n_clusters=k, n_init=10, random_state=42).fit_predict(xy.astype(np.float64))
    return xy, cl

def fetch_vectors(path, id_key):
    ids, vecs = [], []
    off = 0
    while True:
        st, tx = sb("GET", f"{path}&limit=200&offset={off}")
        if st != 200: print(f"[galaxy] fetch {st}: {tx[:200]}"); sys.exit(1)
        rows = json.loads(tx)
        for r in rows:
            ids.append(r[id_key]); vecs.append(json.loads(r["embedding"]))
        if len(rows) < 200: break
        off += 200
        print(f"[galaxy] fetched {len(ids)} vectors", flush=True)
    return ids, vecs

def upsert(table, conflict, rows):
    for i in range(0, len(rows), 300):
        st, tx = sb("POST", f"{table}?on_conflict={conflict}", rows[i:i + 300],
                    prefer="resolution=merge-duplicates,return=minimal")
        if st >= 300: print(f"[galaxy] upsert {st}: {tx[:200]}"); sys.exit(1)
    print(f"[galaxy] wrote {len(rows)} coordinates -> {table}")

def main():
    args = sys.argv[1:]
    if "--labels" in args:
        st, tx = rpc("galaxy_refresh_cluster_labels")
        print(f"[galaxy] labels -> {st}: {tx[:200]}")
        return

    if "--directors" in args:
        ids, vecs = fetch_vectors("director_embedding?select=slug,embedding&order=slug", "slug")
        xy, cl = project(vecs, k=10)
        upsert("director_map_xy", "slug",
               [{"slug": s, "x": round(float(x), 3), "y": round(float(y), 3), "cluster": int(c)}
                for s, (x, y), c in zip(ids, xy, cl)])
        st, tx = rpc("galaxy_refresh_director_labels")
        print(f"[galaxy] director labels -> {st}: {tx[:200]}")
        return

    ids, vecs = fetch_vectors("film_taste_vector?select=film_id,embedding&order=film_id", "film_id")
    xy, cl = project(vecs, k=K)
    upsert("film_map_xy", "film_id",
           [{"film_id": fid, "x": round(float(x), 3), "y": round(float(y), 3), "cluster": int(c)}
            for fid, (x, y), c in zip(ids, xy, cl)])
    st, tx = rpc("galaxy_refresh_cluster_labels")
    print(f"[galaxy] labels -> {st}: {tx[:200]}")

if __name__ == "__main__": main()
