#!/usr/bin/env python3
"""asset-load — asset-all.jsonl → Supabase film_asset (upsert by film_id). Cleans stray HTML."""
import os, sys, json, re, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
_a = sys.argv[1:]  # --out NAME → read NAME.jsonl (CWD-relative; factory namespaced runs). Default = legacy corpus file.
SRC = f"{_a[_a.index('--out') + 1]}.jsonl" if "--out" in _a else os.path.join(HERE, "asset-all.jsonl")
DRY = "--dry" in sys.argv
if not (URL and KEY): sys.exit("Missing SUPABASE env")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
LENS_KEYS = ["auteur_vision", "aesthetic_innovation", "technical_mastery", "philosophical_inquiry",
             "cinematic_lineage", "spatial_aesthetics", "critical_reception", "context_discourse"]

def http(method, url, body=None, headers=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    for k, v in {**H, **(headers or {})}.items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]

def films_map():
    m, off = {}, 0
    while True:
        st, tx = http("GET", f"{URL}/rest/v1/films?select=id,slug&order=id&limit=1000&offset={off}")
        if st != 200: sys.exit(f"films {st}: {tx[:160]}")
        b = json.loads(tx);
        for f in b: m[f["slug"]] = f["id"]
        if len(b) < 1000: break
        off += 1000
    return m

def clean(s):
    s = re.sub(r"\s+", " ", (s or "")).strip()
    return s

def norm_pt(p):
    if isinstance(p, dict):
        lab, txt = clean(p.get("label", "")), clean(p.get("text", ""))
        if txt: return {"label": lab, "text": txt}
        return None
    s = clean(p)                       # string fallback → text only
    return {"label": "", "text": s} if s else None

def norm_lenses(raw):
    out = []
    for L in raw or []:
        k = L.get("key")
        pts = [q for q in (norm_pt(p) for p in (L.get("points") or [])) if q]
        if k in LENS_KEYS and pts:
            out.append({"key": k, "points": pts[:2]})
    out.sort(key=lambda x: LENS_KEYS.index(x["key"]))
    return out

def main():
    if not os.path.exists(SRC): sys.exit(f"missing {SRC} — run asset-batch.py fetch first")
    fmap = films_map()
    rows, miss, empty = [], 0, 0
    for l in open(SRC, encoding="utf-8"):
        l = l.strip()
        if not l: continue
        rec = json.loads(l)
        fid = fmap.get(rec.get("slug"))
        if not fid: miss += 1; continue
        lenses = norm_lenses(rec.get("lenses"))
        if not lenses: empty += 1; continue
        rows.append({"film_id": fid, "lenses": lenses})
    print(f"rows {len(rows)} · unmatched slug {miss} · empty {empty}")
    if DRY:
        for r in rows[:3]:
            p0 = r['lenses'][0]['points'][0]
            print(f"  {r['film_id']}: {len(r['lenses'])} lenses · first: {p0.get('label','')} — {p0.get('text','')[:60]}…")
        print("DRY — no write."); return
    ins = 0
    for i in range(0, len(rows), 200):
        chunk = rows[i:i + 200]
        st, tx = http("POST", f"{URL}/rest/v1/film_asset?on_conflict=film_id", chunk,
                      headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
        if st >= 300: print(f"  ! upsert @{i} {st}: {tx[:200]}")
        else: ins += len(chunk)
        time.sleep(0.03)
    print(f"✅ upserted {ins} rows into film_asset")

if __name__ == "__main__":
    main()
