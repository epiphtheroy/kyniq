#!/usr/bin/env python3
"""Theory Phase 3 — embed theory_canon (the 2,587 canonical traditions).

Why: takes already carry embeddings (vector(1536), text-embedding-3-small). theory_canon
has the SAME column but it is EMPTY, so we cannot match a reading to the tradition it
leans on. This fills theory_canon.embedding in the SAME model space, so a later SQL
nearest-neighbour pass (take.embedding <=> canon.embedding) can attach a "tradition" line
to each Strong Misreading.

Basis (keep stable): "<title> — <theorist>. <major_category> / <sub_category>"
  e.g. "Aura (Art) — Walter Benjamin. I. Aesthetics & Philosophy of Art / B. 19th & 20th..."
This gives the model the concept name, the thinker(s), and the domain — the three things
that decide which tradition a film reading is closest to.

Writeback goes through bulk_set_canon_embeddings (one RPC per ~150 rows) so a dropped
connection costs a batch, not the run. Idempotent: only null embeddings unless --force.

Usage: python3 theory-canon-embed.py [--dry] [--force]
Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
"""
import os, sys, json, time, urllib.request, urllib.error, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)

def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(HERE, ".env.local"))   # worker/.env.local (OMDb etc.)
load_env(os.path.join(ROOT, ".env.local"))   # repo root (OPENAI_API_KEY, Supabase)

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
OPENAI = os.environ.get("OPENAI_API_KEY")
if not (URL and KEY and OPENAI):
    print("Missing env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + OPENAI_API_KEY)"); sys.exit(1)

args = sys.argv[1:]; DRY = "--dry" in args; FORCE = "--force" in args
EMBED_BATCH = 256          # texts per OpenAI call
WRITE_BATCH = 150          # rows per writeback RPC call
MODEL = "text-embedding-3-small"

def http(method, url, headers=None, body=None, timeout=180):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data); req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:400]

def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{URL}/rest/v1/{path}", h, body)

def rpc(name, body):
    return sb("POST", f"rpc/{name}", body, prefer="return=minimal")

def fetch_all(path):
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"{path}&limit=1000&offset={off}")
        if st != 200: raise RuntimeError(f"fetch {st}: {tx[:200]}")
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    return rows

def basis(r):
    title = (r.get("title") or "").strip()
    theorist = (r.get("theorist") or "").strip()
    major = (r.get("major_category") or "").strip()
    sub = (r.get("sub_category") or "").strip()
    head = f"{title} — {theorist}" if theorist else title
    tail = " / ".join([x for x in (major, sub) if x])
    return f"{head}. {tail}".strip().strip(".")

def embed(texts):
    out = []
    for i in range(0, len(texts), EMBED_BATCH):
        chunk = [(t or "")[:8000] or " " for t in texts[i:i+EMBED_BATCH]]
        for attempt in range(5):
            st, tx = http("POST", "https://api.openai.com/v1/embeddings",
                          {"Authorization": f"Bearer {OPENAI}"}, {"model": MODEL, "input": chunk})
            if st == 200: break
            if attempt == 4: raise RuntimeError(f"embed {st}: {tx[:200]}")
            time.sleep(2 * (attempt + 1))
        data = sorted(json.loads(tx)["data"], key=lambda d: d["index"])
        out.extend([d["embedding"] for d in data])
        print(f"    embedded {min(i+EMBED_BATCH,len(texts))}/{len(texts)}")
    return out

def writeback(ids, vecs):
    wrote = 0
    for i in range(0, len(ids), WRITE_BATCH):
        rows = [{"id": ids[j], "e": vecs[j]} for j in range(i, min(i+WRITE_BATCH, len(ids)))]
        for attempt in range(5):
            st, tx = rpc("bulk_set_canon_embeddings", {"p_rows": rows})
            if st < 300: break
            if attempt == 4: raise RuntimeError(f"writeback {st}: {tx[:200]}")
            time.sleep(2 * (attempt + 1))
        wrote += len(rows); print(f"    wrote {wrote}/{len(ids)} canon embeddings")
    return wrote

def main():
    sel = urllib.parse.quote("id,title,theorist,major_category,sub_category", safe="!,():*")
    where = "id=not.is.null" + ("" if FORCE else "&embedding=is.null")
    rows = fetch_all(f"theory_canon?select={sel}&{where}&order=id")
    rows = [r for r in rows if basis(r)]
    print(f"[canon-embed] {len(rows)} rows to embed{' [DRY]' if DRY else ''}  model={MODEL}")
    if rows:
        print("  e.g. ->", basis(rows[0]))
    if DRY or not rows:
        print("[canon-embed] done (dry)" if DRY else "[canon-embed] nothing to do")
        return
    ids = [r["id"] for r in rows]; texts = [basis(r) for r in rows]
    vecs = embed(texts)
    n = writeback(ids, vecs)
    print(f"[canon-embed] done. wrote {n} embeddings. Next: tradition match (SQL).")

if __name__ == "__main__": main()
